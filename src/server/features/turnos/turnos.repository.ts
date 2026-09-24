import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { TurnosVigentesPorMateria, TurnoVigentePorProfesor } from './turnos.validation'

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
}

export type TurnosRepository = typeof turnosRepository
