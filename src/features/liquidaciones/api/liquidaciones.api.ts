import { fetchJson } from '@/utils/fetch-json'

import type {
  AdjuntoDeLiquidacion,
  LiquidacionDetalle,
  LiquidacionesDelMes,
  ListarLiquidacionesDelMesParams,
  MiLiquidacionDetalle,
} from '../liquidaciones.types'

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

/** `profesorId` tal como viene de la URL: no se valida en el cliente (lo rechaza la API). */
export function obtenerLiquidacion({
  profesorId,
  mes,
}: {
  profesorId: string
  mes: string
}): Promise<LiquidacionDetalle> {
  return fetchJson<LiquidacionDetalle>(
    `${BASE}/profesores/${encodeURIComponent(profesorId)}/${encodeURIComponent(mes)}`,
  )
}

/** La liquidación del profesor de la sesión (T-126). */
export function obtenerMiLiquidacion(mes: string): Promise<MiLiquidacionDetalle> {
  return fetchJson<MiLiquidacionDetalle>(`${BASE}/mis-liquidaciones/${encodeURIComponent(mes)}`)
}

/** El comprobante de la transferencia con su URL prefirmada (vence a los 15 minutos). */
export function obtenerComprobanteTransferencia(
  liquidacionId: number,
): Promise<AdjuntoDeLiquidacion> {
  return fetchJson<AdjuntoDeLiquidacion>(`/api/v1/adjuntos/liquidaciones/${liquidacionId}`)
}
