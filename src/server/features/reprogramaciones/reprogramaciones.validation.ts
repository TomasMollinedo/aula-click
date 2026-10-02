import { z } from '@hono/zod-openapi'
import { fechaISO } from '@/server/shared/zod'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'

// Schemas Zod de entrada y salida de reprogramaciones (HU-20, T-49). Son la fuente del OpenAPI. Sin
// reglas de negocio: qué se puede reprogramar y cómo se parte la serie lo decide
// `reprogramaciones.reglas.ts`.

const idPositivo = (description: string, example: number) =>
  z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

/** Body de `POST /reprogramaciones`. La ocurrencia es `(turnoId, fecha)` (definición B). */
export const reprogramarSchema = z
  .object({
    turnoId: idPositivo('Id del turno (o tramo) de la ocurrencia', 41),
    fecha: fechaISO.openapi({
      description: 'Fecha de la ocurrencia que se mueve (la de hoy o posterior)',
      example: '2026-10-12',
    }),
    bloqueAgendaDestinoId: idPositivo('Id de la hora (fila del horario) de destino', 18),
    fechaDestino: fechaISO.openapi({
      description:
        'Fecha de destino: hoy o posterior, en el día de la semana de la hora de destino',
      example: '2026-10-15',
    }),
  })
  .openapi('ReprogramarTurno')

export type ReprogramarTurno = z.infer<typeof reprogramarSchema>

/** Respuesta 200 de `POST /reprogramaciones`. */
export const reprogramadoSchema = z
  .object({
    turnoId: z.number().int().openapi({
      description:
        'Turno resultante de la fecha movida: el mismo si era una sesión única, el `SESION_UNICA` nuevo si era de un recurrente',
      example: 58,
    }),
    cambio: z.string().openapi({
      description: 'Texto para el mensaje de confirmación',
      example:
        'Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz',
    }),
  })
  .openapi('TurnoReprogramado')

export type TurnoReprogramado = z.infer<typeof reprogramadoSchema>

// ---------------------------------------------------------------------------------------------
// Tipos internos (no viajan por HTTP)
// ---------------------------------------------------------------------------------------------

/** Lo que el service le pasa al repository para bloquear y releer. */
export type EntradaReprogramacion = {
  turnoId: number
  fecha: string
  alumnoId: number
  /** Hora (fila) en la que está hoy el turno, leída antes del lock. */
  bloqueOrigenId: number
  bloqueDestinoId: number
  /** Profesor del destino: el que se bloquea `FOR SHARE`. */
  profesorDestinoId: number
  fechaDestino: string
}

/** Lo que la reprogramación necesita de la ocurrencia que se mueve (una `Ocurrencia` lo cumple). */
export type OcurrenciaAMover = Pick<
  Ocurrencia,
  | 'turnoId'
  | 'fecha'
  | 'bloqueAgendaId'
  | 'diaSemana'
  | 'horaInicio'
  | 'horaFin'
  | 'tipo'
  | 'estado'
  | 'alumnoId'
  | 'materiaId'
  | 'pago'
  | 'serie'
> & { profesor: Pick<Ocurrencia['profesor'], 'apellido'> }

/** Una ocurrencia del alumno que se pisa con el destino (una `Ocurrencia` lo cumple). */
export type OcurrenciaSuperpuesta = Pick<
  Ocurrencia,
  'turnoId' | 'tipo' | 'diaSemana' | 'horaInicio' | 'horaFin' | 'serie' | 'materia'
> & { profesor: Pick<Ocurrencia['profesor'], 'id' | 'nombre' | 'apellido'> }

/** Datos releídos bajo lock sobre los que decide `planificarReprogramacion`. */
export type SnapshotReprogramacion = {
  /** La ocurrencia `(turnoId, fecha)` según el motor, o `null` si no existe. */
  ocurrencia: OcurrenciaAMover | null
  turno: { observaciones: string | null; temas: string | null; tieneFinalizacion: boolean } | null
  destino: {
    id: number
    estado: 'ACTIVO' | 'INACTIVO'
    profesorId: number
    diaSemana: number
    horaInicio: number
    horaFin: number
    aulaCapacidad: number
  } | null
  profesor: {
    id: number
    capacidad: number
    estado: 'ACTIVO' | 'INACTIVO'
    apellido: string
  } | null
  materia: { estado: 'ACTIVO' | 'INACTIVO' } | null
  asignacion: { estado: 'ACTIVO' | 'INACTIVO' } | null
  /** Ocurrencias que ocupan lugar en el destino en `fechaDestino`, sin contar la que se mueve. */
  ocupacionDestino: number
  /** Ocurrencias del alumno que se pisan con el destino, sin contar la que se mueve. */
  superpuestas: readonly OcurrenciaSuperpuesta[]
}

export type PlanReprogramacion = {
  /** Cambios al turno original. Sólo viajan las claves que cambian. */
  original: {
    tipo?: 'SESION_UNICA'
    bloqueAgendaId?: number
    fechaInicio?: string
    fechaFin?: string | null
    /** `null` cuando el original pasa a sesión única: deja de ser parte de una serie (T-103). */
    serieId?: null
  }
  /**
   * Tramo `RECURRENTE` nuevo (mismo bloque que el original), o `null`. Hereda el `serieId` del
   * original (decisión T-103; `null` si el original no lo tiene).
   */
  tramoNuevo: { fechaInicio: string; fechaFin: string | null; serieId: string | null } | null
  /**
   * `SESION_UNICA` nueva en el destino con la fecha movida (sin `serieId`: queda fuera de la
   * serie); `false` si se edita el original.
   */
  sesionNueva: boolean
  /** La `FinalizacionRecurrencia` del original pasa al tramo nuevo. */
  finalizacionAlTramo: boolean
  /** La `FinalizacionRecurrencia` del original se borra (queda como sesión única). */
  borrarFinalizacion: boolean
  /** Las cancelaciones y los pagos posteriores a `fecha` pasan al tramo nuevo. */
  reapuntarPosterioresAlTramo: boolean
  /** El pago de la fecha movida (si lo hay) pasa al turno resultante con `fechaDestino`. */
  moverPago: boolean
  cambio: string
}
