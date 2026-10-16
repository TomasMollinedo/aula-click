import { fetchJson } from '@/utils/fetch-json'

import type { LiquidacionesDelMes, ListarLiquidacionesDelMesParams } from '../liquidaciones.types'

const BASE = '/api/v1/liquidaciones'

/** Sin `mes`, la API devuelve el último mes terminado. */
export function obtenerLiquidacionesDelMes({
  mes,
  page,
}: ListarLiquidacionesDelMesParams): Promise<LiquidacionesDelMes> {
  const params = new URLSearchParams({ page: String(page) })
  if (mes !== undefined) params.set('mes', mes)
  return fetchJson<LiquidacionesDelMes>(`${BASE}?${params.toString()}`)
}
