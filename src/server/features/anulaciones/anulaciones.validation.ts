import { z } from '@hono/zod-openapi'

// Schemas Zod de entrada y salida de anulaciones (HU-42, T-104). Son la fuente del OpenAPI. Sin
// reglas de negocio: qué pago se puede anular y qué avisos van los decide `anulaciones.reglas.ts`.

export const DETALLE_MAX = 500

export const MOTIVOS_ANULACION = ['ERROR_CARGA', 'FORMA_PAGO_EQUIVOCADA', 'OTRO'] as const
export type MotivoAnulacion = (typeof MOTIVOS_ANULACION)[number]

export const MENSAJE_DETALLE_OBLIGATORIO = 'El detalle es obligatorio cuando el motivo es "Otro"'

const idPositivo = (description: string, example: number) =>
  z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

const importe = (description: string, example: number) =>
  z.number().openapi({ description, example })

/** Query de `GET /anulaciones/previa`. Uno no numérico, cero o negativo responde 400. */
export const previaQuerySchema = z.object({
  pagoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'pagoId', in: 'query' },
      description: 'Id del pago a anular',
      example: 31,
    }),
})

export type PreviaQuery = z.infer<typeof previaQuerySchema>

/** Body de `POST /anulaciones`. */
export const anularPagoSchema = z
  .object({
    pagoId: idPositivo('Id del pago a anular', 31),
    motivo: z
      .enum(MOTIVOS_ANULACION, { error: 'Motivo inválido' })
      .openapi({ description: 'Motivo de la anulación', example: 'ERROR_CARGA' }),
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
        example: 'Se cargó el alumno equivocado',
      }),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && !datos.detalle) {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })
  .openapi('AnularPago')

export type AnularPago = z.infer<typeof anularPagoSchema>

/** Respuesta 201 de `POST /anulaciones`. */
export const pagoAnuladoSchema = z
  .object({
    pagoId: z.number().int().openapi({ description: 'Pago anulado', example: 31 }),
    cantidad: z
      .number()
      .int()
      .openapi({ description: 'Turnos que volvieron a quedar pendientes de pago', example: 4 }),
  })
  .openapi('PagoAnulado')

export type PagoAnulado = z.infer<typeof pagoAnuladoSchema>

const personaSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  apellido: z.string(),
})

/** Aviso de deuda: el alumno quedaría con deuda vencida (HU-29). Informa, no bloquea. */
export const avisoDeudaSchema = z
  .object({
    cantidad: z.number().int().openapi({
      description: 'Turnos que tendría de deuda vencida: la de hoy más los del pago',
      example: 5,
    }),
    total: importe(
      'Su importe, a precio vigente: los turnos de una materia sin precio no suman',
      40000,
    ),
    turnosDelPago: z.number().int().openapi({
      description: 'Cuántos de esos turnos son de este pago (fecha de 30 días o más)',
      example: 4,
    }),
  })
  .openapi('AvisoDeudaAnulacion')

/** Aviso de precio: el precio vigente de una materia es distinto del que se cobró en el pago. */
export const avisoPrecioSchema = z
  .object({
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    cobrado: importe('Precio por hora que se cobró en este pago', 8000),
    vigente: z.number().nullable().openapi({
      description:
        'Precio por hora vigente al que se volverían a cobrar; `null` si la materia no tiene precio',
      example: 9000,
    }),
  })
  .openapi('AvisoPrecioAnulacion')

/** Aviso de transferencia compartida: otros pagos vigentes con la misma operación y banco. */
export const avisoTransferenciaSchema = z
  .object({
    operacion: z.string().openapi({ example: '0004829137' }),
    banco: z.string().openapi({ example: 'Banco Macro' }),
    pagos: z
      .array(
        z.object({
          pagoId: z.number().int(),
          numeroComprobante: z.number().int(),
          alumno: personaSchema,
        }),
      )
      .openapi({ description: 'Los otros pagos vigentes: no se anulan con este' }),
  })
  .openapi('AvisoTransferenciaAnulacion')

/** Respuesta de `GET /anulaciones/previa`: el resumen para la confirmación y sus avisos. */
export const previaAnulacionSchema = z
  .object({
    pago: z.object({
      id: z.number().int().openapi({ example: 31 }),
      numeroComprobante: z.number().int().openapi({ example: 123 }),
      alumno: personaSchema,
      total: importe('Total del pago, en pesos', 32000),
      cantidad: z.number().int().openapi({ description: 'Turnos del pago', example: 4 }),
    }),
    avisos: z
      .object({
        deuda: avisoDeudaSchema.nullable(),
        precios: z.array(avisoPrecioSchema),
        transferenciaCompartida: avisoTransferenciaSchema.nullable(),
      })
      .openapi({
        description:
          'Avisos que informan sin bloquear: `deuda` y `transferenciaCompartida` son `null` y `precios` es `[]` si no hay nada que avisar',
      }),
  })
  .openapi('PreviaAnulacion')

export type PreviaAnulacion = z.infer<typeof previaAnulacionSchema>

/** Lo que el service le pasa al repository para anular (ya validado). */
export type EntradaAnulacion = {
  pagoId: number
  alumnoId: number
  motivo: MotivoAnulacion
  detalle: string | null
}
