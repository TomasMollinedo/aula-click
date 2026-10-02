import { z } from '@hono/zod-openapi'
import type { MotivoCancelacion } from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de entrada y salida de finalizaciones (HU-14, T-47). Son la fuente del OpenAPI. Sin
// reglas de negocio: qué turno se puede finalizar y desde cuándo lo decide
// `finalizaciones.reglas.ts`.
//
// El motivo y el detalle son los de la cancelación (HU-13) y están **duplicados a propósito** de
// `cancelaciones.validation.ts`: de otra feature no se importa la validation.

export const DETALLE_MAX = 500

export const MOTIVOS_CANCELACION = [
  'CANCELACION_ALUMNO',
  'CANCELACION_PROFESOR',
  'PROBLEMA_ADMINISTRATIVO',
  'OTRO',
] as const satisfies readonly MotivoCancelacion[]

export const MENSAJE_DETALLE_OBLIGATORIO = 'El detalle es obligatorio cuando el motivo es "Otro"'

/** Query de `GET /finalizaciones/previa`. */
export const previaFinalizacionQuerySchema = z.object({
  turnoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'turnoId', in: 'query' },
      description:
        'Id del turno recurrente desde cuyo detalle se opera (cualquier tramo de esa hora)',
      example: 41,
    }),
  fechaDesde: fechaISO.openapi({
    param: { name: 'fechaDesde', in: 'query' },
    description: 'Primera fecha que se libera (YYYY-MM-DD)',
    example: '2026-10-19',
  }),
})

export type PreviaFinalizacionQuery = z.infer<typeof previaFinalizacionQuerySchema>

/** Body de `POST /finalizaciones`. */
export const finalizarTurnoSchema = z
  .object({
    turnoId: z
      .number({ error: 'Debe ser un número' })
      .int({ error: 'Debe ser un número entero' })
      .positive({ error: 'Debe ser mayor a 0' })
      .openapi({
        description:
          'Id del turno recurrente desde cuyo detalle se opera: se finaliza su hora, en todos los tramos de su serie',
        example: 41,
      }),
    fechaDesde: fechaISO.openapi({
      description:
        'Primera fecha que se libera: de hoy en adelante, en el día de la serie, posterior al primer inicio de esa hora y no posterior a su último fin',
      example: '2026-10-19',
    }),
    motivo: z
      .enum(MOTIVOS_CANCELACION, { error: 'Motivo inválido' })
      .openapi({ description: 'Motivo de la finalización', example: 'CANCELACION_ALUMNO' }),
    detalle: z
      .string({ error: 'Debe ser un texto' })
      .trim()
      .max(DETALLE_MAX, { error: `No puede superar los ${DETALLE_MAX} caracteres` })
      .transform((valor) => (valor === '' ? null : valor))
      .nullable()
      .optional()
      .openapi({
        description: `Detalle libre, hasta ${DETALLE_MAX} caracteres; obligatorio si \`motivo = OTRO\`. "" o solo espacios se guarda como null`,
        type: 'string',
        maxLength: DETALLE_MAX,
        example: 'El alumno deja de venir',
      }),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && !datos.detalle) {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })
  .openapi('FinalizarTurno')

export type FinalizarTurno = z.infer<typeof finalizarTurnoSchema>

/** Una ocurrencia pagada desde `fechaDesde`: impide finalizar (definición D). */
export const turnoPagadoSchema = z
  .object({
    fecha: fechaISO.openapi({ example: '2026-10-26' }),
    horaInicio: horaHHmm.openapi({ example: '09:00' }),
    horaFin: horaHHmm.openapi({ example: '10:00' }),
    importe: z.number().openapi({ description: 'Importe cobrado', example: 8500 }),
  })
  .openapi('TurnoPagado')

export type TurnoPagado = z.infer<typeof turnoPagadoSchema>

/**
 * Otra hora de la misma serie (decisión T-103) que sigue agendada desde `fechaDesde`: no se
 * finaliza con este pedido. `turnoId` + `fecha` es su primera ocurrencia desde `fechaDesde`, la
 * que abre su detalle.
 */
export const otraHoraSchema = z
  .object({
    turnoId: z.number().int().openapi({ example: 42 }),
    fecha: fechaISO.openapi({
      description: 'Primera ocurrencia de esa hora desde `fechaDesde`',
      example: '2026-10-19',
    }),
    horaInicio: horaHHmm.openapi({ example: '10:00' }),
    horaFin: horaHHmm.openapi({ example: '11:00' }),
  })
  .openapi('OtraHora')

export type OtraHora = z.infer<typeof otraHoraSchema>

const resumen = {
  cantidad: z.number().int().nullable().openapi({
    description:
      'Turnos que se liberan (no cancelados) de `desde` a `hasta`, de todos los tramos de la hora. `null` si no tiene fin',
    example: 7,
  }),
  desde: fechaISO.openapi({ description: 'Igual a `fechaDesde`', example: '2026-10-19' }),
  hasta: fechaISO.nullable().openapi({
    description: 'Última ocurrencia de la hora. `null` si no tiene fin',
    example: '2026-11-30',
  }),
}

/** Respuesta 200 de `GET /finalizaciones/previa`. */
export const previaFinalizacionSchema = z
  .object({
    ...resumen,
    pagadas: z.array(turnoPagadoSchema).openapi({
      description: 'Turnos pagados desde `fechaDesde`, por fecha. Si hay alguno, no se finaliza',
    }),
    ultimaFechaPagada: fechaISO.nullable().openapi({
      description: 'Fecha del último turno pagado; `null` si no hay pagados',
      example: null,
    }),
    fechaDesdeMinima: fechaISO.nullable().openapi({
      description:
        'Primera `fechaDesde` posible: la ocurrencia siguiente al último pagado. `null` si no hay pagados, o si los pagados llegan hasta el final de la serie (no se puede finalizar)',
      example: null,
    }),
    otrasHoras: z.array(otraHoraSchema).openapi({
      description:
        'Las otras horas de la serie con alguna ocurrencia desde `fechaDesde` y sin finalizar, por hora: no se finalizan con este pedido, sino desde su propio detalle',
    }),
  })
  .openapi('PreviaFinalizacion')

export type PreviaFinalizacion = z.infer<typeof previaFinalizacionSchema>

/** Respuesta 201 de `POST /finalizaciones`: misma forma que el resumen de la previa. */
export const finalizacionCreadaSchema = z
  .object({
    turnoId: z.number().int().openapi({ description: 'El turno pedido', example: 41 }),
    ...resumen,
  })
  .openapi('FinalizacionCreada')

export type FinalizacionCreada = z.infer<typeof finalizacionCreadaSchema>

/** Lo que el service le pasa al repository para finalizar (ya validado). */
export type EntradaFinalizacion = {
  turnoId: number
  alumnoId: number
  fechaDesde: string
  motivo: (typeof MOTIVOS_CANCELACION)[number]
  detalle: string | null
}
