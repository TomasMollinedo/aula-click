import { fetchJson } from '@/utils/fetch-json'

import type {
  FinalizacionCreada,
  FinalizarTurnoBody,
  PreviaFinalizacion,
  PreviaFinalizacionParams,
} from '../finalizaciones.types'

const BASE = '/api/v1/finalizaciones'

export function obtenerPrevia({
  turnoId,
  fechaDesde,
}: PreviaFinalizacionParams): Promise<PreviaFinalizacion> {
  const query = new URLSearchParams({ turnoId: String(turnoId), fechaDesde })
  return fetchJson<PreviaFinalizacion>(`${BASE}/previa?${query}`)
}

export function finalizarTurno(datos: FinalizarTurnoBody): Promise<FinalizacionCreada> {
  return fetchJson<FinalizacionCreada>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
