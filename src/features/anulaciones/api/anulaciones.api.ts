import { fetchJson } from '@/utils/fetch-json'

import type { AnulacionCreada, AnularPagoBody, PreviaAnulacion } from '../anulaciones.types'

const BASE = '/api/v1/anulaciones'

export function obtenerPrevia(pagoId: number): Promise<PreviaAnulacion> {
  const query = new URLSearchParams({ pagoId: String(pagoId) })
  return fetchJson<PreviaAnulacion>(`${BASE}/previa?${query}`)
}

export function anularPago(datos: AnularPagoBody): Promise<AnulacionCreada> {
  return fetchJson<AnulacionCreada>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
