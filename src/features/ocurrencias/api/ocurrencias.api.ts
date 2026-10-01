import { fetchJson } from '@/utils/fetch-json'

import type { OcurrenciaDeAlumno, OcurrenciaDetalle } from '@/types/ocurrencia'
import type { ObtenerOcurrenciaParams, OcurrenciasDelAlumnoParams } from '../ocurrencias.types'

const BASE = '/api/v1/ocurrencias'

/** Detalle de la ocurrencia `turnoId` + `fecha` (T-43). */
export function obtenerOcurrencia({
  turnoId,
  fecha,
}: ObtenerOcurrenciaParams): Promise<OcurrenciaDetalle> {
  return fetchJson<OcurrenciaDetalle>(`${BASE}/${turnoId}/${fecha}`)
}

/** Las ocurrencias de un alumno en `[desde, hasta]` (pestaña "Turnos" de la ficha). */
export function listarOcurrenciasDelAlumno(
  params: OcurrenciasDelAlumnoParams,
): Promise<OcurrenciaDeAlumno[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('alumnoId', String(params.alumnoId))
  if (params.desde) searchParams.set('desde', params.desde)
  if (params.hasta) searchParams.set('hasta', params.hasta)

  return fetchJson<OcurrenciaDeAlumno[]>(`${BASE}?${searchParams.toString()}`)
}
