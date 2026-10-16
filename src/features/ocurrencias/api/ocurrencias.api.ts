import { fetchJson } from '@/utils/fetch-json'

import type {
  OcurrenciaDeAlumno,
  OcurrenciaDetalle,
  OcurrenciaDelPortal,
  OcurrenciaDetallePortal,
} from '@/types/ocurrencia'
import type {
  MisTurnosParams,
  ObtenerOcurrenciaParams,
  OcurrenciasDelAlumnoParams,
} from '../ocurrencias.types'

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

/** Detalle de una ocurrencia del alumno de la sesión (portal, HU-30). */
export function obtenerMiTurno({
  turnoId,
  fecha,
}: ObtenerOcurrenciaParams): Promise<OcurrenciaDetallePortal> {
  return fetchJson<OcurrenciaDetallePortal>(`${BASE}/mis-turnos/${turnoId}/${fecha}`)
}

/** Los turnos del alumno de la sesión en `[desde, hasta]`, con las canceladas ("Mi calendario", HU-30). */
export function listarMisTurnos({ desde, hasta }: MisTurnosParams): Promise<OcurrenciaDelPortal[]> {
  const searchParams = new URLSearchParams({ desde, hasta })
  return fetchJson<OcurrenciaDelPortal[]>(`${BASE}/mis-turnos?${searchParams.toString()}`)
}
