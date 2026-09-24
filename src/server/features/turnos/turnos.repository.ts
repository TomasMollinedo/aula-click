import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type {
  OcupacionPorBloque,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError).
// Sin reglas de negocio.

/**
 * Condición de **turno vigente** (docs/dominio.md → Turnos): `fechaFin` nula o >= hoy. En este
 * release todo turno es `SESION_UNICA` (T-20/T-30, sin recurrentes), con `fechaFin = fechaInicio`;
 * la condición queda igual por si `fechaFin` no viene cargada. Un turno `CANCELADO` no cuenta: la
 * vigencia se decide por fecha, pero un cancelado no bloquea nada.
 *
 * Es la **única** implementación de la condición (convenciones-backend.md → Turno vigente): se
 * reutiliza desde acá, nunca se reescribe en otra feature. `fechaHoy` la calcula el service con
 * `hoy()` y su reloj inyectable.
 */
export function condicionTurnoVigente(fechaHoy: string) {
  return {
    estado: 'ACTIVO',
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(fechaHoy) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * Condición de **turno que ocupa lugar** en una fila de `bloque_agenda` en una fecha puntual:
 * estado `ACTIVO` (un `CANCELADO` libera su lugar) y `fechaInicio` igual a esa fecha (todo turno
 * es de una fecha puntual, T-30). Es la ocupación que muestra el horario (T-17) y **la misma
 * condición que tiene que usar el control de capacidad de T-21 (`BLOQUE_LLENO`)**: se reutiliza
 * desde acá, nunca se reescribe. Se combina con el `bloqueAgendaId` de la fila.
 */
export function condicionTurnoOcupaLugar(fecha: string) {
  return {
    estado: 'ACTIVO',
    fechaInicio: fechaADate(fecha),
  } satisfies Prisma.TurnoWhereInput
}

export const turnosRepository = {
  /**
   * Cantidad de turnos vigentes por materia, filtrable por profesor (el del bloque) y materias.
   * Solo vienen las materias con al menos un turno vigente.
   */
  async contarVigentesPorMateria(filtro: {
    fechaHoy: string
    profesorId?: number
    materiaIds?: number[]
  }): Promise<TurnosVigentesPorMateria[]> {
    const grupos = await prisma.turno.groupBy({
      by: ['materiaId'],
      where: {
        ...condicionTurnoVigente(filtro.fechaHoy),
        ...(filtro.profesorId === undefined
          ? {}
          : { bloqueAgenda: { profesorId: filtro.profesorId } }),
        ...(filtro.materiaIds === undefined ? {} : { materiaId: { in: filtro.materiaIds } }),
      },
      _count: { _all: true },
      orderBy: { materiaId: 'asc' },
    })
    return grupos.map((grupo) => ({ materiaId: grupo.materiaId, cantidad: grupo._count._all }))
  },

  /**
   * Cantidad de turnos vigentes de un bloque puntual. La usa `bloques` (T-17) para decidir
   * `TURNOS_VIGENTES` antes de editar o dar de baja una fila.
   */
  async contarVigentesPorBloque(bloqueAgendaId: number, fechaHoy: string): Promise<number> {
    return prisma.turno.count({
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgendaId },
    })
  },

  /**
   * Turnos vigentes del profesor (de cualquiera de sus bloques), con los datos que HU-06 pide
   * mostrar antes de la baja: alumno, materia, fecha y horario. La usa `profesores` para decidir
   * `TURNOS_VIGENTES` antes de dar de baja. Ordenados por fecha y luego id.
   */
  async listarVigentesPorProfesor(
    profesorId: number,
    fechaHoy: string,
  ): Promise<TurnoVigentePorProfesor[]> {
    const filas = await prisma.turno.findMany({
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgenda: { profesorId } },
      select: {
        alumno: { select: { id: true, nombre: true, apellido: true } },
        materia: { select: { id: true, nombre: true } },
        fechaInicio: true,
        bloqueAgenda: { select: { horaInicio: true, horaFin: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
    })
    return filas.map((fila) => ({
      alumno: fila.alumno,
      materia: fila.materia,
      fecha: dateAFecha(fila.fechaInicio),
      horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
      horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
    }))
  },

  /**
   * Como `contarVigentesPorBloque`, pero para varias filas en una sola consulta. Solo vienen las
   * filas con al menos un turno vigente. La usa `bloques` para la baja de varias horas juntas.
   */
  async contarVigentesPorBloques(
    bloqueAgendaIds: number[],
    fechaHoy: string,
  ): Promise<TurnosVigentesPorBloque[]> {
    const grupos = await prisma.turno.groupBy({
      by: ['bloqueAgendaId'],
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgendaId: { in: bloqueAgendaIds } },
      _count: { _all: true },
      orderBy: { bloqueAgendaId: 'asc' },
    })
    return grupos.map((grupo) => ({
      bloqueAgendaId: grupo.bloqueAgendaId,
      cantidad: grupo._count._all,
    }))
  },

  /**
   * Turnos que ocupan lugar (`condicionTurnoOcupaLugar`) en cada par fila–fecha pedido, en una
   * sola consulta para todo el horario (sin N+1). Solo vienen los pares con al menos un turno.
   */
  async contarOcupacionPorBloque(
    pares: { bloqueAgendaId: number; fecha: string }[],
  ): Promise<OcupacionPorBloque[]> {
    if (pares.length === 0) return []
    const grupos = await prisma.turno.groupBy({
      by: ['bloqueAgendaId', 'fechaInicio'],
      where: {
        OR: pares.map(({ bloqueAgendaId, fecha }) => ({
          ...condicionTurnoOcupaLugar(fecha),
          bloqueAgendaId,
        })),
      },
      _count: { _all: true },
      orderBy: [{ bloqueAgendaId: 'asc' }, { fechaInicio: 'asc' }],
    })
    return grupos.map((grupo) => ({
      bloqueAgendaId: grupo.bloqueAgendaId,
      fecha: dateAFecha(grupo.fechaInicio),
      cantidad: grupo._count._all,
    }))
  },
}

export type TurnosRepository = typeof turnosRepository
