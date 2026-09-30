import { z } from '@hono/zod-openapi'
import type { MotivoCancelacion } from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaISO } from '@/server/shared/zod'

// Schemas Zod de entrada y salida de cancelaciones (HU-13, T-45). Son la fuente del OpenAPI. Sin
// reglas de negocio: qué ocurrencias se pueden cancelar lo decide `cancelaciones.reglas.ts`.

/** Máximo de ocurrencias en una cancelación (mismo tope que un pago, decisión T-64). */
export const MAX_OCURRENCIAS_POR_CANCELACION = 200
export const DETALLE_MAX = 500

export const MOTIVOS_CANCELACION = [
  'CANCELACION_ALUMNO',
  'CANCELACION_PROFESOR',
  'PROBLEMA_ADMINISTRATIVO',
  'OTRO',
] as const satisfies readonly MotivoCancelacion[]

export const MENSAJE_DETALLE_OBLIGATORIO = 'El detalle es obligatorio cuando el motivo es "Otro"'

const idPositivo = (description: string, example: number) =>
  z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

/** Una ocurrencia a cancelar: `(turnoId, fecha)` (definición B). */
export const ocurrenciaACancelarSchema = z
  .object({
    turnoId: idPositivo('Id del turno (o tramo)', 41),
    fecha: fechaISO.openapi({ description: 'Fecha de la ocurrencia', example: '2026-10-12' }),
  })
  .openapi('OcurrenciaACancelar')

export type OcurrenciaACancelar = z.infer<typeof ocurrenciaACancelarSchema>

/** Body de `POST /cancelaciones`. El alumno no viaja: sale de las ocurrencias. */
export const cancelarTurnosSchema = z
  .object({
    ocurrencias: z
      .array(ocurrenciaACancelarSchema, { error: 'Debe ser una lista de ocurrencias' })
      .min(1, { error: 'Elegí al menos un turno' })
      .max(MAX_OCURRENCIAS_POR_CANCELACION, {
        error: `No se pueden cancelar más de ${MAX_OCURRENCIAS_POR_CANCELACION} turnos a la vez`,
      })
      .superRefine((ocurrencias, ctx) => {
        const vistas = new Set<string>()
        ocurrencias.forEach(({ turnoId, fecha }, i) => {
          const clave = `${turnoId}|${fecha}`
          if (vistas.has(clave)) {
            ctx.addIssue({
              code: 'custom',
              path: [i],
              message: 'La ocurrencia está repetida en el pedido',
            })
          }
          vistas.add(clave)
        })
      })
      .openapi({
        description: `Ocurrencias a cancelar, de 1 a ${MAX_OCURRENCIAS_POR_CANCELACION}, sin repetir \`(turnoId, fecha)\`. Todas del mismo alumno`,
      }),
    motivo: z
      .enum(MOTIVOS_CANCELACION, { error: 'Motivo inválido' })
      .openapi({ description: 'Motivo de la cancelación', example: 'CANCELACION_ALUMNO' }),
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
        example: 'El alumno viaja esa semana',
      }),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && !datos.detalle) {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })
  .openapi('CancelarTurnos')

export type CancelarTurnos = z.infer<typeof cancelarTurnosSchema>

/** Respuesta 201 de `POST /cancelaciones`. */
export const cancelacionesCreadasSchema = z
  .object({
    cantidad: z.number().int().openapi({ description: 'Ocurrencias canceladas', example: 2 }),
  })
  .openapi('CancelacionesCreadas')

export type CancelacionesCreadas = z.infer<typeof cancelacionesCreadasSchema>

/** Lo que el service le pasa al repository para cancelar (ya validado). */
export type EntradaCancelacion = {
  alumnoId: number
  ocurrencias: OcurrenciaACancelar[]
  motivo: (typeof MOTIVOS_CANCELACION)[number]
  detalle: string | null
}
