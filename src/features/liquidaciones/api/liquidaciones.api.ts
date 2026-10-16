import { fetchJson } from '@/utils/fetch-json'

import type {
  AdjuntoDeLiquidacion,
  LiquidacionDetalle,
  LiquidacionesDelMes,
  ListarLiquidacionesDelMesParams,
  MiLiquidacionDetalle,
  MisIngresos,
  MisLiquidaciones,
  PagoLiquidacionRegistrado,
  RegistrarPagoLiquidacion,
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

/** Registra la transferencia al profesor y cierra la liquidación (T-132). */
export function registrarPagoLiquidacion({
  profesorId,
  mes,
  body,
}: {
  profesorId: number
  mes: string
  body: RegistrarPagoLiquidacion
}): Promise<PagoLiquidacionRegistrado> {
  return fetchJson<PagoLiquidacionRegistrado>(
    `${BASE}/profesores/${encodeURIComponent(String(profesorId))}/${encodeURIComponent(mes)}/pago`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

/** "Mis ingresos" del profesor de la sesión (T-126): el mes en curso y sus clases. */
export function obtenerMisIngresos(): Promise<MisIngresos> {
  return fetchJson<MisIngresos>(`${BASE}/mis-ingresos`)
}

/** Las liquidaciones del profesor de la sesión, una por mes, sin el mes en curso (T-126). */
export function obtenerMisLiquidaciones(page: number, pageSize: number): Promise<MisLiquidaciones> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return fetchJson<MisLiquidaciones>(`${BASE}/mis-liquidaciones?${params.toString()}`)
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
