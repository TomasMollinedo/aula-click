import { fetchJson } from '@/utils/fetch-json'

import type {
  AdeudadosGlobal,
  CuentaDelAlumno,
  FiltrosCuentaParams,
  ListarGlobalParams,
  ProximosGlobal,
} from '../cuentas.types'

const BASE = '/api/v1/cuentas'

/** Los filtros en el query: un filtro vacío no se manda. */
function conFiltros(searchParams: URLSearchParams, filtros: FiltrosCuentaParams): URLSearchParams {
  if (filtros.desde) searchParams.set('desde', filtros.desde)
  if (filtros.hasta) searchParams.set('hasta', filtros.hasta)
  if (filtros.materiaId != null) searchParams.set('materiaId', String(filtros.materiaId))
  if (filtros.profesorId != null) searchParams.set('profesorId', String(filtros.profesorId))
  return searchParams
}

function queryGlobal(params: ListarGlobalParams): string {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params.page))
  if (params.alumnoId != null) searchParams.set('alumnoId', String(params.alumnoId))
  return conFiltros(searchParams, params).toString()
}

export function obtenerCuentaDelAlumno(
  alumnoId: number,
  filtros: FiltrosCuentaParams = {},
): Promise<CuentaDelAlumno> {
  const qs = conFiltros(new URLSearchParams(), filtros).toString()
  return fetchJson<CuentaDelAlumno>(`${BASE}/alumnos/${alumnoId}${qs ? `?${qs}` : ''}`)
}

/** Adeudados de todos los alumnos, o solo de `alumnoId` si viene. */
export function listarAdeudados(params: ListarGlobalParams): Promise<AdeudadosGlobal> {
  return fetchJson<AdeudadosGlobal>(`${BASE}/adeudados?${queryGlobal(params)}`)
}

/** Próximos turnos de todos los alumnos, o solo de `alumnoId` si viene. */
export function listarProximos(params: ListarGlobalParams): Promise<ProximosGlobal> {
  return fetchJson<ProximosGlobal>(`${BASE}/proximos?${queryGlobal(params)}`)
}
