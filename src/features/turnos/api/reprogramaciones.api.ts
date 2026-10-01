import { fetchJson } from '@/utils/fetch-json'

import type { ReprogramacionCreada, ReprogramarTurnoBody } from '../reprogramacion.types'

const BASE = '/api/v1/reprogramaciones'

export function reprogramarTurno(datos: ReprogramarTurnoBody): Promise<ReprogramacionCreada> {
  return fetchJson<ReprogramacionCreada>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
