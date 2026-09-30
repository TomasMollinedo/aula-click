import { fetchJson } from '@/utils/fetch-json'

import type { AdeudadosGlobal, CuentaDelAlumno, ListarAdeudadosParams } from '../cuentas.types'

const BASE = '/api/v1/cuentas'

export function obtenerCuentaDelAlumno(alumnoId: number): Promise<CuentaDelAlumno> {
  return fetchJson<CuentaDelAlumno>(`${BASE}/alumnos/${alumnoId}`)
}

/** Adeudados de todos los alumnos, o solo de `alumnoId` si viene. */
export function listarAdeudados(params: ListarAdeudadosParams): Promise<AdeudadosGlobal> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params.page))
  if (params.alumnoId != null) searchParams.set('alumnoId', String(params.alumnoId))

  return fetchJson<AdeudadosGlobal>(`${BASE}/adeudados?${searchParams.toString()}`)
}
