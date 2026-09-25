import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { dateAFecha, diaSemanaISO, fechaADate } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { minutosAHora } from '@/server/shared/zod'
import type {
  AgendaListado,
  MateriasConTurnoListado,
  OcupacionPorBloque,
  ProfesoresConTurnoListado,
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

/**
 * Condición de **turno que aplica en una fecha** (dominio.md → Turnos): `fechaInicio <= fecha` y
 * `fechaFin` nula o >= fecha. Cubre por igual una sesión única (`fechaInicio === fechaFin`, la
 * única forma que crea T-21 en este release) y un turno con rango, si alguna vez existe uno
 * cargado a mano: no hace falta reintroducir `TipoTurno.RECURRENTE` ni `TurnoExcepcion` (T-30)
 * para que la lectura lo contemple. No alcanza sola: hay que combinarla con que `fecha` caiga en
 * el día de la semana del bloque (`bloqueAgenda.diaSemana`), que es lo que hace que un turno de
 * rango "ocurra" justo ese día. Es la única implementación: la reutiliza la agenda diaria (T-23)
 * y, si hace falta, la agenda propia del profesor (T-25).
 */
export function condicionTurnoEnFecha(fecha: string) {
  return {
    estado: 'ACTIVO',
    fechaInicio: { lte: fechaADate(fecha) },
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(fecha) } }],
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
  /**
   * Página de la agenda de una fecha: turnos que aplican ese día (`condicionTurnoEnFecha`) cuyo
   * bloque cae en el día de la semana correspondiente, excluyendo los `CANCELADO`. Filtrable por
   * materia, aula, profesor y alumno. Ordenada por hora de inicio y, dentro de la hora, por
   * profesor (apellido y nombre, vía `busqueda` de su `Usuario`), y por `id` del turno si todo lo
   * anterior coincide.
   */
  async listarAgenda(filtro: {
    fecha: string
    page: number
    pageSize: number
    materiaId?: number
    aulaId?: number
    profesorId?: number
    alumnoId?: number
  }): Promise<AgendaListado> {
    const where = {
      ...condicionTurnoEnFecha(filtro.fecha),
      bloqueAgenda: {
        diaSemana: diaSemanaISO(filtro.fecha),
        ...(filtro.aulaId === undefined ? {} : { aulaId: filtro.aulaId }),
        ...(filtro.profesorId === undefined ? {} : { profesorId: filtro.profesorId }),
      },
      ...(filtro.materiaId === undefined ? {} : { materiaId: filtro.materiaId }),
      ...(filtro.alumnoId === undefined ? {} : { alumnoId: filtro.alumnoId }),
    } satisfies Prisma.TurnoWhereInput

    const [filas, total] = await prisma.$transaction([
      prisma.turno.findMany({
        where,
        select: {
          id: true,
          estado: true,
          alumno: { select: { id: true, apellido: true, nombre: true } },
          materia: { select: { id: true, nombre: true } },
          bloqueAgenda: {
            select: {
              horaInicio: true,
              horaFin: true,
              aula: { select: { id: true, nombre: true } },
              profesor: {
                select: { id: true, usuario: { select: { apellido: true, nombre: true } } },
              },
            },
          },
        },
        orderBy: [
          { bloqueAgenda: { horaInicio: 'asc' } },
          { bloqueAgenda: { profesor: { usuario: { busqueda: 'asc' } } } },
          { id: 'asc' },
        ],
        ...calcularSkipTake(filtro),
      }),
      prisma.turno.count({ where }),
    ])

    return {
      data: filas.map((fila) => ({
        id: fila.id,
        alumno: fila.alumno,
        profesor: {
          id: fila.bloqueAgenda.profesor.id,
          apellido: fila.bloqueAgenda.profesor.usuario.apellido,
          nombre: fila.bloqueAgenda.profesor.usuario.nombre,
        },
        materia: fila.materia,
        aula: fila.bloqueAgenda.aula,
        horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
        horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
        estado: fila.estado,
      })),
      meta: armarMeta(filtro, total),
    }
  },

  /**
   * Materias con al menos un turno que aplica esa fecha (`condicionTurnoEnFecha`, excluyendo los
   * `CANCELADO`), para el selector de materias de la agenda en el frontend. Ordenadas por nombre
   * (`busqueda`, sin tildes ni mayúsculas) y luego `id`. Sin paginar: es un selector de catálogo.
   *
   * A propósito **no filtra por `Materia.estado`**: importa si esa materia se dictó ese día, no si
   * hoy sigue activa. Con una fecha pasada, una materia dada de baja después sigue apareciendo si
   * tuvo un turno `ACTIVO` ese día (a diferencia de `materiasRepository.listarActivas()`, el
   * selector del catálogo vigente, que sí filtra por `estado`).
   */
  async listarMateriasConTurno(fecha: string): Promise<MateriasConTurnoListado> {
    return prisma.materia.findMany({
      where: {
        turnos: {
          some: {
            ...condicionTurnoEnFecha(fecha),
            bloqueAgenda: { diaSemana: diaSemanaISO(fecha) },
          },
        },
      },
      select: { id: true, nombre: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
    })
  },

  /**
   * Profesores con al menos un bloque que ese día de la semana tiene un turno que aplica esa
   * fecha (`condicionTurnoEnFecha`, excluyendo los `CANCELADO`), para el selector de profesor de
   * la agenda en el frontend. Ordenados por apellido y nombre (`busqueda` de su `Usuario`) y luego
   * `id`. Sin paginar: es un selector de catálogo.
   *
   * A propósito **no filtra por el estado del profesor** (el de su `Usuario`): importa si dictó
   * clase ese día, no si hoy sigue activo. Con una fecha pasada, un profesor dado de baja después
   * sigue apareciendo si tuvo un turno `ACTIVO` ese día.
   */
  async listarProfesoresConTurno(fecha: string): Promise<ProfesoresConTurnoListado> {
    const filas = await prisma.profesor.findMany({
      where: {
        bloques: {
          some: {
            diaSemana: diaSemanaISO(fecha),
            turnos: { some: condicionTurnoEnFecha(fecha) },
          },
        },
      },
      select: { id: true, usuario: { select: { apellido: true, nombre: true } } },
      orderBy: [{ usuario: { busqueda: 'asc' } }, { id: 'asc' }],
    })
    return filas.map(({ id, usuario }) => ({ id, ...usuario }))
  },
}

export type TurnosRepository = typeof turnosRepository
