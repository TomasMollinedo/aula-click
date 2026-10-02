import { fetchJson } from '@/utils/fetch-json'

import type { PeriodoTablero, Tablero } from '../tablero.types'

const BASE = '/api/v1/tablero'

export function obtenerTablero({ desde, hasta }: PeriodoTablero): Promise<Tablero> {
  const params = new URLSearchParams({ desde, hasta })
  return fetchJson<Tablero>(`${BASE}?${params.toString()}`)
}
