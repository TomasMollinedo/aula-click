import { ApiError } from '@/utils/fetch-json'

import {
  CAMPOS_PAGO_LIQUIDACION_FORM,
  type CampoPagoLiquidacionForm,
} from './pago-liquidacion.schema'

// Errores del pago de una liquidación (docs/contrato-api.md → Liquidaciones, `POST …/pago`) y de la
// subida de su comprobante (→ Adjuntos) en lo que muestra el diálogo. Es el único lugar que conoce
// los códigos: el diálogo hace un `switch` sobre `tipo`.

export const CODIGO_LIQUIDACION_MODIFICADA = 'LIQUIDACION_MODIFICADA'
const CODIGO_ADJUNTO_INVALIDO = 'ADJUNTO_INVALIDO'

const MENSAJE_SIN_PERMISO = 'No tenés permiso para esta operación'
const MENSAJE_SIN_CONEXION = 'No se pudo registrar el pago. Revisá la conexión e intentá de nuevo.'
const MENSAJE_SIN_CONEXION_SUBIDA =
  'No se pudo completar la operación. Revisá la conexión e intentá de nuevo.'

export type ErrorPagoLiquidacion =
  /** 400 por campo del formulario. `mensaje`: lo que no corresponde a un campo, o `null`. */
  | {
      tipo: 'campos'
      campos: { campo: CampoPagoLiquidacionForm; mensaje: string }[]
      mensaje: string | null
    }
  /** 409 `LIQUIDACION_MODIFICADA`: el total cambió desde que se abrió el detalle. */
  | { tipo: 'modificada'; mensaje: string }
  /** Otro 409 o el 404: no tiene sentido reintentar. */
  | { tipo: 'conflicto'; mensaje: string }
  | { tipo: 'general'; mensaje: string }

type Detalle = { path: unknown[]; message: string }

function esDetalle(d: unknown): d is Detalle {
  return (
    typeof d === 'object' &&
    d !== null &&
    Array.isArray((d as { path?: unknown }).path) &&
    typeof (d as { message?: unknown }).message === 'string'
  )
}

const camposValidos = new Set<string>(CAMPOS_PAGO_LIQUIDACION_FORM)

function interpretarValidacion(error: ApiError): ErrorPagoLiquidacion {
  const details = error.details
  if (!Array.isArray(details) || details.length === 0 || !details.every(esDetalle)) {
    return { tipo: 'general', mensaje: error.message }
  }
  const campos: { campo: CampoPagoLiquidacionForm; mensaje: string }[] = []
  let mensaje: string | null = null
  for (const d of details) {
    const raiz = d.path[0]
    if (d.path.length === 1 && typeof raiz === 'string' && camposValidos.has(raiz)) {
      const campo = raiz as CampoPagoLiquidacionForm
      if (!campos.some((c) => c.campo === campo)) campos.push({ campo, mensaje: d.message })
    } else {
      // Por ejemplo `['mes']` o `['totalConfirmado']`: no hay nada que corregir en el formulario.
      mensaje = mensaje ?? d.message
    }
  }
  if (campos.length === 0) return { tipo: 'general', mensaje: mensaje ?? error.message }
  return { tipo: 'campos', campos, mensaje }
}

/**
 * Convierte el error del `POST …/pago` en lo que muestra el diálogo. Acepta cualquier error: uno
 * que no sea un `ApiError` (red) cae a `general`. El 401 lo redirige `providers.tsx`.
 */
export function interpretarErrorPagoLiquidacion(error: unknown): ErrorPagoLiquidacion {
  if (!(error instanceof ApiError)) return { tipo: 'general', mensaje: MENSAJE_SIN_CONEXION }
  if (error.status === 403) return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO }
  if (
    error.status === 400 &&
    (error.code === 'VALIDACION' || error.code === CODIGO_ADJUNTO_INVALIDO)
  ) {
    // `ADJUNTO_INVALIDO` trae su detalle en `comprobanteAdjuntoId`: el campo "Comprobante".
    return interpretarValidacion(error)
  }
  if (error.status === 409 && error.code === CODIGO_LIQUIDACION_MODIFICADA) {
    return { tipo: 'modificada', mensaje: error.message }
  }
  // `LIQUIDACION_PAGADA`, el `CONFLICTO` del mes no terminado o sin importe, y el 404 del profesor.
  if (error.status === 409 || error.status === 404) {
    return { tipo: 'conflicto', mensaje: error.message }
  }
  return { tipo: 'general', mensaje: error.message }
}

/**
 * El error de subir el comprobante (`POST /adjuntos`) en el texto del campo: un 400 en
 * `["archivo"]` con su mensaje; el resto con el `message` de la API. Misma lógica que
 * `errorDeAdjunto` de `pagos`, reducida a la subida (no se importa: no es un hook).
 */
export function errorDeSubidaComprobante(error: unknown): string {
  if (!(error instanceof ApiError)) return MENSAJE_SIN_CONEXION_SUBIDA
  if (error.status === 400 && Array.isArray(error.details)) {
    const detalle = error.details.find((d): d is Detalle => esDetalle(d) && d.path[0] === 'archivo')
    if (detalle) return detalle.message
  }
  if (error.status === 403) return MENSAJE_SIN_PERMISO
  return error.message
}
