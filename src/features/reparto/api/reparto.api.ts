import { fetchJson } from '@/utils/fetch-json'

import type {
  CambiarPorcentajeBody,
  ObtenerPorcentajeParams,
  PorcentajeCentroConHistorial,
  PorcentajeVigente,
} from '../reparto.types'

const BASE = '/api/v1/reparto/porcentaje'

/** El vigente y una página del historial. */
export function obtenerPorcentaje({
  page,
  pageSize,
}: ObtenerPorcentajeParams): Promise<PorcentajeCentroConHistorial> {
  const searchParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return fetchJson<PorcentajeCentroConHistorial>(`${BASE}?${searchParams}`)
}

/** Registra un porcentaje nuevo; responde con el nuevo vigente. */
export function cambiarPorcentaje(porcentaje: number): Promise<PorcentajeVigente> {
  const body: CambiarPorcentajeBody = { porcentaje }
  return fetchJson<PorcentajeVigente>(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
