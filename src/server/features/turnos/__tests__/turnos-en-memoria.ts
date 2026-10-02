import { vi } from 'vitest'

// Tabla de turnos en memoria para los tests del motor de ocurrencias (T-30). `turno.findMany`
// aplica el `where` que arma `leerSeries` (solo las claves que usa) y los `where` de las relaciones
// filtradas del `select` (cancelaciones y pagos del rango), y devuelve las filas con la forma que
// devuelve Prisma (fechas `@db.Date` como `Date` a medianoche UTC, importes con `toNumber()`). Así
// se prueban el prefiltro de la base y la regla en memoria juntos, sin base.

export type BloqueDePrueba = {
  id: number
  profesorId: number
  aulaId: number
  diaSemana: number
  horaInicio: number
  horaFin?: number
  estado?: 'ACTIVO' | 'INACTIVO'
}

export type TurnoDePrueba = {
  id: number
  bloqueAgendaId: number
  alumnoId?: number
  materiaId?: number
  /** La serie del alta (decisión T-103). Sin dato, `null`. */
  serieId?: string | null
  tipo?: 'RECURRENTE' | 'SESION_UNICA'
  estado?: 'ACTIVO' | 'CANCELADO'
  fechaInicio: string
  fechaFin: string | null
  finalizadaDesde?: string
  cancelaciones?: { fecha: string; motivo?: string; detalle?: string | null }[]
  pagos?: { fecha: string; pagoId: number; importe: number }[]
}

export const d = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`)

type Rango = { gte?: Date; lte?: Date }
const enRango = (fecha: Date, rango: Rango) =>
  (rango.gte === undefined || fecha >= rango.gte) && (rango.lte === undefined || fecha <= rango.lte)

type WhereSerie = {
  estado?: string
  fechaInicio?: { lte: Date }
  OR?: ({ fechaFin: null } | { fechaFin: { gte: Date } })[]
  alumnoId?: number
  materiaId?: { in: number[] }
  id?: { in: number[] }
  bloqueAgendaId?: { in: number[] }
  bloqueAgenda?: {
    profesorId?: number
    aulaId?: number
    estado?: string
    diaSemana?: { in: number[] }
    horaInicio?: { lt: number }
    horaFin?: { gt: number }
  }
}

type SelectSerie = {
  cancelaciones: { where: { fechaOcurrencia: Rango } }
  pagoTurnos: { where: { fechaOcurrencia: Rango } }
}

/** Crea la tabla y el `turno.findMany` falso que la consulta. */
export function crearTurnosEnMemoria(bloques: BloqueDePrueba[], turnos: TurnoDePrueba[]) {
  const findMany = vi.fn(async ({ where, select }: { where: WhereSerie; select: SelectSerie }) =>
    turnos
      .map((turno) => ({ turno, bloque: bloques.find((b) => b.id === turno.bloqueAgendaId) }))
      .filter(({ turno, bloque }) => {
        if (!bloque) return false
        const estado = turno.estado ?? 'ACTIVO'
        const fin = turno.fechaFin === null ? null : d(turno.fechaFin)
        const b = where.bloqueAgenda ?? {}
        const horaFin = bloque.horaFin ?? bloque.horaInicio + 60
        return (
          (where.estado === undefined || estado === where.estado) &&
          (where.fechaInicio === undefined || d(turno.fechaInicio) <= where.fechaInicio.lte) &&
          (where.OR === undefined ||
            where.OR.some((o) =>
              o.fechaFin === null ? fin === null : fin !== null && fin >= o.fechaFin.gte,
            )) &&
          (where.alumnoId === undefined || (turno.alumnoId ?? 12) === where.alumnoId) &&
          (where.materiaId === undefined || where.materiaId.in.includes(turno.materiaId ?? 3)) &&
          (where.id === undefined || where.id.in.includes(turno.id)) &&
          (where.bloqueAgendaId === undefined ||
            where.bloqueAgendaId.in.includes(turno.bloqueAgendaId)) &&
          (b.profesorId === undefined || bloque.profesorId === b.profesorId) &&
          (b.aulaId === undefined || bloque.aulaId === b.aulaId) &&
          (b.estado === undefined || (bloque.estado ?? 'ACTIVO') === b.estado) &&
          (b.diaSemana === undefined || b.diaSemana.in.includes(bloque.diaSemana)) &&
          (b.horaInicio === undefined || bloque.horaInicio < b.horaInicio.lt) &&
          (b.horaFin === undefined || horaFin > b.horaFin.gt)
        )
      })
      .sort(
        (a, b) =>
          (a.bloque?.horaInicio ?? 0) - (b.bloque?.horaInicio ?? 0) || a.turno.id - b.turno.id,
      )
      .map(({ turno, bloque }) => {
        const bloqueReal = bloque as BloqueDePrueba
        const alumnoId = turno.alumnoId ?? 12
        const materiaId = turno.materiaId ?? 3
        return {
          id: turno.id,
          bloqueAgendaId: turno.bloqueAgendaId,
          alumnoId,
          materiaId,
          serieId: turno.serieId ?? null,
          tipo:
            turno.tipo ?? (turno.fechaFin === turno.fechaInicio ? 'SESION_UNICA' : 'RECURRENTE'),
          estado: turno.estado ?? 'ACTIVO',
          fechaInicio: d(turno.fechaInicio),
          fechaFin: turno.fechaFin === null ? null : d(turno.fechaFin),
          bloqueAgenda: {
            diaSemana: bloqueReal.diaSemana,
            horaInicio: bloqueReal.horaInicio,
            horaFin: bloqueReal.horaFin ?? bloqueReal.horaInicio + 60,
            profesorId: bloqueReal.profesorId,
            aulaId: bloqueReal.aulaId,
            aula: { id: bloqueReal.aulaId, nombre: `Aula ${bloqueReal.aulaId}` },
            profesor: {
              id: bloqueReal.profesorId,
              usuario: {
                nombre: `Profe${bloqueReal.profesorId}`,
                apellido: `Apellido${bloqueReal.profesorId}`,
                busqueda: `apellido${bloqueReal.profesorId} profe${bloqueReal.profesorId}`,
              },
            },
          },
          alumno: {
            id: alumnoId,
            nombre: `Alumno${alumnoId}`,
            apellido: `Apellido${alumnoId}`,
            busqueda: `apellido${alumnoId} alumno${alumnoId}`,
          },
          materia: { id: materiaId, nombre: `Materia${materiaId}` },
          finalizacion: turno.finalizadaDesde ? { fechaDesde: d(turno.finalizadaDesde) } : null,
          cancelaciones: (turno.cancelaciones ?? [])
            .filter((c) => enRango(d(c.fecha), select.cancelaciones.where.fechaOcurrencia))
            .map((c) => ({
              fechaOcurrencia: d(c.fecha),
              motivo: c.motivo ?? 'CANCELACION_ALUMNO',
              detalle: c.detalle ?? null,
              createdById: 'usr_mesa',
              createdAt: new Date('2026-09-20T12:00:00.000Z'),
            })),
          pagoTurnos: (turno.pagos ?? [])
            .filter((p) => enRango(d(p.fecha), select.pagoTurnos.where.fechaOcurrencia))
            .map((p) => ({
              fechaOcurrencia: d(p.fecha),
              pagoId: p.pagoId,
              importeAplicado: { toNumber: () => p.importe },
            })),
        }
      }),
  )
  return { findMany }
}
