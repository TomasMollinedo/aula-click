import { z } from '@hono/zod-openapi'
import { usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { paginatedSchema } from '@/server/shared/paginacion'

// Schemas Zod de entrada y salida de reparto (HU-43, T-120). Son la fuente del OpenAPI. Sin reglas
// de negocio: el reparto lo calcula `reparto.reglas.ts` y "ya es el vigente" lo decide el service.

export const MENSAJE_PORCENTAJE_INVALIDO =
  'El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales'

// Con la tolerancia de la nota de los exámenes (`examenes.validation.ts`).
function conHastaDosDecimales(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-9
}

/** Body de `PUT /reparto/porcentaje`. Cualquier incumplimiento da un solo 400 en `porcentaje`. */
export const cambiarPorcentajeSchema = z
  .object({
    porcentaje: z
      .number({ error: MENSAJE_PORCENTAJE_INVALIDO })
      .refine((valor) => valor >= 0 && valor < 100 && conHastaDosDecimales(valor), {
        error: MENSAJE_PORCENTAJE_INVALIDO,
      })
      .openapi({
        description: 'Porcentaje del centro: >= 0 y < 100, con hasta dos decimales (18 = 18 %)',
        example: 18,
      }),
  })
  .openapi('PorcentajeCentroCambiar')

export type CambiarPorcentaje = z.infer<typeof cambiarPorcentajeSchema>

/** El porcentaje vigente: desde cuándo rige y quién lo cambió. Respuesta de `PUT`. */
export const porcentajeCentroSchema = z
  .object({
    porcentaje: z
      .number()
      .openapi({ description: 'Porcentaje del centro (18 = 18 %)', example: 18 }),
    desde: z.iso.datetime().openapi({
      description: 'Desde cuándo rige: instante ISO 8601 en UTC',
      example: '2026-10-15T20:10:00.000Z',
    }),
    cambiadoPor: usuarioAuditoriaSchema,
  })
  .openapi('PorcentajeCentro')

export type PorcentajeCentro = z.infer<typeof porcentajeCentroSchema>

const cambioPorcentajeSchema = porcentajeCentroSchema.extend({
  id: z.number().int().openapi({ example: 3 }),
})

export type CambioPorcentaje = z.infer<typeof cambioPorcentajeSchema>

/** Respuesta de `GET /reparto/porcentaje`: el vigente y el historial paginado. */
export const porcentajeCentroConHistorialSchema = z
  .object({
    vigente: porcentajeCentroSchema,
    historial: paginatedSchema(cambioPorcentajeSchema).openapi({
      description:
        'Cada cambio, del más reciente al más antiguo: el vigente es la primera fila de la página 1',
    }),
  })
  .openapi('PorcentajeCentroConHistorial')

export type PorcentajeCentroConHistorial = z.infer<typeof porcentajeCentroConHistorialSchema>
