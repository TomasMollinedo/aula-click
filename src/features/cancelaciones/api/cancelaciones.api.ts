import { fetchJson } from '@/utils/fetch-json'

import type { CancelacionesCreadas, CancelarTurnosBody } from '../cancelaciones.types'

const BASE = '/api/v1/cancelaciones'

export function cancelarTurnos(datos: CancelarTurnosBody): Promise<CancelacionesCreadas> {
  return fetchJson<CancelacionesCreadas>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
