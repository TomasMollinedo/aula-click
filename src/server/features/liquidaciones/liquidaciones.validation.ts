import { z } from '@hono/zod-openapi'
import { usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import {
  fechaISO,
  horaHHmm,
  importe,
  mesISO,
  textoOpcional,
  textoRequerido,
} from '@/server/shared/zod'
import { ESTADOS_LIQUIDACION, textoMes, type ProfesorRef } from './liquidaciones.reglas'

// Schemas Zod de entrada y salida de liquidaciones (HU-44, T-124). Son la fuente del OpenAPI. Sin
// reglas de negocio: el cálculo es del motor (`liquidaciones.condiciones.ts`) y el mes por defecto,
// "no futuro" y cuándo se puede pagar los deciden el service y el repository.

export const MENSAJE_MES_FUTURO = 'El mes no puede ser futuro'
export const MENSAJE_TRANSFERENCIA_FUTURA = 'La fecha de la transferencia no puede ser futura'

// Los 409 del pago (`POST …/pago`).
export const CODIGO_LIQUIDACION_PAGADA = 'LIQUIDACION_PAGADA'
export const CODIGO_LIQUIDACION_MODIFICADA = 'LIQUIDACION_MODIFICADA'
export const MENSAJE_SIN_IMPORTE = 'No hay importe a pagar'
export const MENSAJE_LIQUIDACION_MODIFICADA =
  'La liquidación cambió desde que la abriste. Revisala antes de pagar'

/** "La liquidación de noviembre de 2026 todavía no se puede pagar: el mes no terminó". */
export const mensajeMesNoTerminado = (mes: string) =>
  `La liquidación de ${textoMes(mes)} todavía no se puede pagar: el mes no terminó`

/** "La liquidación de octubre de 2026 de Gómez, Ana ya está pagada". */
export const mensajeYaPagada = (mes: string, profesor: ProfesorRef) =>
  `La liquidación de ${textoMes(mes)} de ${profesor.apellido}, ${profesor.nombre} ya está pagada`

const idPositivo = (description: string, example: number) =>
  z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

const pesos = (description: string, example: number) => z.number().openapi({ description, example })

// ---------- Entrada ----------

export const liquidacionesQuerySchema = paginacionQuerySchema.extend({
  mes: mesISO.optional().openapi({
    param: { name: 'mes', in: 'query' },
    description:
      'Mes a liquidar (AAAA-MM). Por defecto, el último mes terminado. No puede ser futuro',
    example: '2026-09',
  }),
})

export type LiquidacionesQuery = z.infer<typeof liquidacionesQuerySchema>

export const liquidacionParamsSchema = z.object({
  profesorId: idPositivo('Id del profesor', 4).openapi({
    param: { name: 'profesorId', in: 'path' },
  }),
  mes: mesISO.openapi({
    param: { name: 'mes', in: 'path' },
    description: 'Mes de la liquidación (AAAA-MM). No puede ser futuro',
    example: '2026-09',
  }),
})

export type LiquidacionParams = z.infer<typeof liquidacionParamsSchema>

// ---------- Piezas ----------

const estadoLiquidacionSchema = z.enum(ESTADOS_LIQUIDACION).openapi('EstadoLiquidacion', {
  description:
    '`EN_CURSO` (mes en curso), `PENDIENTE_DE_PAGO`, `SALDO_A_DESCONTAR` (total de 0 o menos, pasa al mes siguiente), `PAGADA` o `DESCONTADA` (absorbida por la de otro mes)',
})

const profesorLiquidacionSchema = z
  .object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })
  .openapi('ProfesorLiquidacion')

/** Los totales de una liquidación o de todo el mes: la misma forma. */
const totalesSchema = z.object({
  cantidadTurnos: z.number().int().openapi({ example: 12 }),
  totalCobrado: pesos('Suma de los importes cobrados de los turnos', 96000),
  parteCentro: pesos('Lo que retiene el centro', 14400),
  parteProfesor: pesos('Lo que le corresponde al profesor por los turnos', 81600),
  totalAjustes: pesos('Suma de los ajustes (negativos: anulaciones y saldo anterior)', -4400),
  total: pesos('A pagar: parte del profesor + ajustes', 77200),
})

export const totalesLiquidacionSchema = totalesSchema.openapi('TotalesLiquidacion')

export type TotalesLiquidacion = z.infer<typeof totalesLiquidacionSchema>

// ---------- Listado del mes ----------

const filaLiquidacionSchema = totalesSchema
  .extend({
    profesor: profesorLiquidacionSchema,
    estado: estadoLiquidacionSchema,
    fechaTransferencia: fechaISO.nullable().openapi({
      description: 'Sólo en una `PAGADA`',
      example: '2026-10-05',
    }),
    descontadaEnMes: mesISO.nullable().openapi({
      description: 'Sólo en una `DESCONTADA`: el mes de la liquidación que absorbió su saldo',
      example: null,
    }),
  })
  .openapi('LiquidacionDelMes')

export type FilaLiquidacion = z.infer<typeof filaLiquidacionSchema>

export const liquidacionesDelMesSchema = paginatedSchema(filaLiquidacionSchema)
  .extend({
    mes: mesISO.openapi({ description: 'El mes pedido o el por defecto' }),
    totales: totalesLiquidacionSchema.openapi({
      description: 'Suma de cada columna de todo el listado, no de la página',
    }),
  })
  .openapi('LiquidacionesDelMes')

export type LiquidacionesDelMes = z.infer<typeof liquidacionesDelMesSchema>

// ---------- Detalle ----------

const turnoLiquidacionSchema = z
  .object({
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    alumno: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    numeroComprobante: z
      .number()
      .int()
      .openapi({ description: 'Del cobro del turno', example: 123 }),
    importe: pesos('Importe cobrado del turno', 8000),
    porcentaje: z.number().openapi({ description: 'Porcentaje del centro del cobro', example: 15 }),
    parteProfesor: pesos('Parte del profesor', 6800),
  })
  .openapi('TurnoDeLiquidacion')

const ajusteLiquidacionSchema = z
  .object({
    tipo: z.enum(['ANULACION', 'SALDO_ANTERIOR']),
    texto: z.string().openapi({
      example: 'Ajuste por anulación del comprobante N.º 123 (2 turnos)',
    }),
    importe: pesos('Negativo: lo que descuenta', -13600),
  })
  .openapi('AjusteDeLiquidacion')

const adjuntoLiquidacionSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    tipo: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    bytes: z.number().int(),
    adjuntadoPor: usuarioAuditoriaSchema,
    adjuntadoEl: z.iso.datetime(),
  })
  .openapi('ComprobanteDeTransferencia', {
    description: 'Sin URL: se pide a `GET /adjuntos/liquidaciones/{liquidacionId}` al abrirlo',
  })

const cerradaSchema = z
  .object({
    liquidacionId: z.number().int(),
    fechaTransferencia: fechaISO.nullable().openapi({ description: '`null` en una `DESCONTADA`' }),
    numeroOperacion: z.string().nullable(),
    observaciones: z.string().nullable(),
    descontadaEnMes: mesISO.nullable().openapi({ description: 'Sólo en una `DESCONTADA`' }),
    comprobanteAdjunto: adjuntoLiquidacionSchema.nullable(),
    registradaPor: usuarioAuditoriaSchema,
    registradaEl: z.iso.datetime().openapi({ description: 'Instante ISO 8601 en UTC' }),
  })
  .openapi('LiquidacionCerrada')

export const liquidacionDetalleSchema = totalesSchema
  .extend({
    profesor: profesorLiquidacionSchema,
    mes: mesISO,
    estado: estadoLiquidacionSchema.nullable().openapi({
      description: '`null` si el profesor no tiene movimientos en el mes',
    }),
    turnos: z.array(turnoLiquidacionSchema),
    ajustes: z.array(ajusteLiquidacionSchema),
    cerrada: cerradaSchema.nullable().openapi({
      description: 'Datos del cierre (`PAGADA` o `DESCONTADA`); `null` si está abierta',
    }),
    acciones: z.object({
      registrarPago: z.boolean().openapi({ description: 'Sólo en `PENDIENTE_DE_PAGO`' }),
    }),
  })
  .openapi('LiquidacionDetalle')

export type LiquidacionDetalle = z.infer<typeof liquidacionDetalleSchema>

// ---------- Pago ----------

/** Body de `POST /liquidaciones/profesores/{profesorId}/{mes}/pago`. El monto no se manda. */
export const pagarLiquidacionSchema = z
  .object({
    fechaTransferencia: fechaISO.openapi({
      description: 'No futura y no anterior al último día del mes liquidado',
      example: '2026-10-05',
    }),
    numeroOperacion: textoRequerido(50).openapi({
      description: 'Número de operación de la transferencia, hasta 50 caracteres',
      example: '0004829137',
    }),
    comprobanteAdjuntoId: idPositivo(
      'Id del comprobante de la transferencia subido antes con `POST /adjuntos` (opcional)',
      44,
    ).nullish(),
    observaciones: textoOpcional(
      500,
      'Observaciones de la transferencia, hasta 500 caracteres',
      'Transferencia a la cuenta del Banco Macro',
    ),
    totalConfirmado: importe('El total confirmado').openapi({
      description:
        'El `total` que mostró el detalle: control de que la liquidación no cambió (sin pagos parciales)',
      example: 81600,
    }),
  })
  .openapi('PagarLiquidacion')

export type PagarLiquidacion = z.infer<typeof pagarLiquidacionSchema>

/** Respuesta 201 del pago: lo justo para "Pago registrado. La liquidación de … quedó pagada". */
export const liquidacionPagadaSchema = z
  .object({
    liquidacionId: z.number().int().openapi({ example: 31 }),
    profesor: profesorLiquidacionSchema,
    mes: mesISO,
    total: pesos('Lo pagado: el total calculado', 81600),
    fechaTransferencia: fechaISO,
  })
  .openapi('LiquidacionPagada')

export type LiquidacionPagada = z.infer<typeof liquidacionPagadaSchema>
