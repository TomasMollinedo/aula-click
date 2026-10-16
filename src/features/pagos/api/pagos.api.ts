import { fetchJson } from '@/utils/fetch-json'

import type { DetallePago } from '../pago-detalle.types'
import type { PagoRegistrado, RegistrarPago } from '../pagos.types'

const BASE = '/api/v1/pagos'

/** Registra el pago en efectivo de una o varias ocurrencias de un alumno, todo o nada. */
export function registrarPago(datos: RegistrarPago): Promise<PagoRegistrado> {
  return fetchJson<PagoRegistrado>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

/** El detalle de un pago: el comprobante, la cantidad de turnos, el adjunto y las acciones. */
export function obtenerPago(pagoId: number): Promise<DetallePago> {
  return fetchJson<DetallePago>(`${BASE}/${pagoId}`)
}
