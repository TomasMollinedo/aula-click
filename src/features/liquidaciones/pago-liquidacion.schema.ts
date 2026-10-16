import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { RegistrarPagoLiquidacion } from './liquidaciones.types'

// Schema del formulario de registrar el pago de una liquidación (HU-44, T-132): solo formato y
// campos obligatorios (docs/arquitectura-frontend.md → Formularios), como `pagos.schema.ts`. Que la
// fecha no sea futura ni anterior al último día del mes liquidado lo decide la API, y su 400 se
// muestra en el campo. El monto no es un campo: es el `total` de la liquidación que abrió el diálogo
// y viaja como `totalConfirmado`.

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/
const MAX_OPERACION = 50
const MAX_OBSERVACIONES = 500
const CAMPO_OBLIGATORIO = 'Campo obligatorio'

export const pagoLiquidacionFormSchema = z.object({
  fechaTransferencia: z.string().superRefine((texto, ctx) => {
    const mensaje =
      texto === ''
        ? CAMPO_OBLIGATORIO
        : !FECHA_FORMATO.test(texto)
          ? 'Fecha inválida: debe tener formato AAAA-MM-DD'
          : isValid(parseISO(texto))
            ? null
            : 'La fecha no es válida'
    if (mensaje) ctx.addIssue({ code: 'custom', message: mensaje })
  }),
  numeroOperacion: z.string().superRefine((texto, ctx) => {
    const limpio = texto.trim()
    if (!limpio) ctx.addIssue({ code: 'custom', message: CAMPO_OBLIGATORIO })
    else if (limpio.length > MAX_OPERACION) {
      ctx.addIssue({ code: 'custom', message: `No puede superar los ${MAX_OPERACION} caracteres` })
    }
  }),
  /** El comprobante ya subido (`POST /adjuntos`), o `null`: lo pone el campo "Comprobante". */
  comprobanteAdjuntoId: z.number().int().positive().nullable(),
  observaciones: z
    .string()
    .max(MAX_OBSERVACIONES, { message: `No puede superar los ${MAX_OBSERVACIONES} caracteres` }),
})

export type PagoLiquidacionFormValues = z.input<typeof pagoLiquidacionFormSchema>

/** Campos del formulario que un 400 de la API puede marcar. */
export const CAMPOS_PAGO_LIQUIDACION_FORM = [
  'fechaTransferencia',
  'numeroOperacion',
  'comprobanteAdjuntoId',
  'observaciones',
] as const satisfies readonly (keyof PagoLiquidacionFormValues)[]

export type CampoPagoLiquidacionForm = (typeof CAMPOS_PAGO_LIQUIDACION_FORM)[number]

/**
 * Valores iniciales: la fecha de la transferencia en `hoy` (la fecha local del navegador,
 * `YYYY-MM-DD`, que pasa quien monta el formulario) y el resto vacío. Qué es "hoy" para la regla lo
 * decide la API.
 */
export function valoresInicialesPagoLiquidacion(hoy: string): PagoLiquidacionFormValues {
  return {
    fechaTransferencia: hoy,
    numeroOperacion: '',
    comprobanteAdjuntoId: null,
    observaciones: '',
  }
}

/**
 * Body del `POST …/pago`. El número de operación va sin espacios alrededor; observaciones vacías o
 * solo espacios van `null`. `total` es el de la liquidación que guardó el detalle al abrir.
 */
export function armarPagoLiquidacion(
  valores: PagoLiquidacionFormValues,
  total: number,
): RegistrarPagoLiquidacion {
  const observaciones = valores.observaciones.trim()
  return {
    fechaTransferencia: valores.fechaTransferencia,
    numeroOperacion: valores.numeroOperacion.trim(),
    comprobanteAdjuntoId: valores.comprobanteAdjuntoId,
    observaciones: observaciones || null,
    totalConfirmado: total,
  }
}
