import { fetchJson } from '@/utils/fetch-json'

import type { AdjuntoConUrl } from '../pago-detalle.types'
import type { AdjuntoSubido } from '../pagos.types'

// El comprobante adjunto de un pago (HU-24, docs/contrato-api.md → Adjuntos): el archivo que trae
// la familia, no el comprobante de pago en PDF que emite el centro.

const BASE_ADJUNTOS = '/api/v1/adjuntos'
const BASE = `${BASE_ADJUNTOS}/pagos`

/**
 * Sube un comprobante **antes** de registrar el pago (HU-24, T-97): multipart con un único campo
 * `archivo` (JPG, PNG o PDF, hasta 5 MB). Queda sin pago hasta que `POST /pagos` lo vincula con
 * `comprobanteAdjuntoId`; uno que nunca se vincula queda guardado y no se muestra.
 */
export function subirAdjunto(archivo: File): Promise<AdjuntoSubido> {
  const formData = new FormData()
  formData.set('archivo', archivo)
  return fetchJson<AdjuntoSubido>(BASE_ADJUNTOS, { method: 'POST', body: formData })
}

/** El último adjunto activo del pago, con su URL prefirmada (vence a los 15 minutos). */
export function obtenerAdjuntoDePago(pagoId: number): Promise<AdjuntoConUrl> {
  return fetchJson<AdjuntoConUrl>(`${BASE}/${pagoId}`)
}

/**
 * Multipart con un único campo `archivo` (JPG, PNG o PDF, hasta 5 MB). Reemplaza el comprobante
 * (el anterior queda guardado) o, en un débito sin adjunto, lo adjunta.
 */
export function reemplazarAdjuntoDePago(pagoId: number, archivo: File): Promise<AdjuntoConUrl> {
  const formData = new FormData()
  formData.set('archivo', archivo)
  return fetchJson<AdjuntoConUrl>(`${BASE}/${pagoId}`, { method: 'PUT', body: formData })
}

/** Quita el comprobante de un pago con débito (baja lógica: el archivo queda guardado). 204. */
export function quitarAdjuntoDePago(pagoId: number): Promise<void> {
  return fetchJson<void>(`${BASE}/${pagoId}`, { method: 'DELETE' })
}
