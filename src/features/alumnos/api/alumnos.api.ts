import { fetchJson } from '@/utils/fetch-json'

import type {
  AlumnoCrear,
  AlumnoDetalle,
  AlumnoEditar,
  AlumnosDeProfesorListadoResponse,
  AlumnosListadoResponse,
  ListarAlumnosParams,
  ListarMisAlumnosParams,
} from '../alumnos.types'

const BASE = '/api/v1/alumnos'

export function listarAlumnos(params: ListarAlumnosParams): Promise<AlumnosListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.q) searchParams.set('q', params.q)

  const qs = searchParams.toString()
  return fetchJson<AlumnosListadoResponse>(qs ? `${BASE}?${qs}` : BASE)
}

/** Alumnos del profesor de la sesión (rol PROFESOR): con un turno vigente con él. */
export function listarMisAlumnos(
  params: ListarMisAlumnosParams,
): Promise<AlumnosDeProfesorListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.q) searchParams.set('q', params.q)
  if (params.materiaId != null) searchParams.set('materiaId', String(params.materiaId))

  const qs = searchParams.toString()
  return fetchJson<AlumnosDeProfesorListadoResponse>(
    qs ? `${BASE}/mis-alumnos?${qs}` : `${BASE}/mis-alumnos`,
  )
}

export function obtenerAlumno(id: number): Promise<AlumnoDetalle> {
  return fetchJson<AlumnoDetalle>(`${BASE}/${id}`)
}

export function crearAlumno(datos: AlumnoCrear): Promise<AlumnoDetalle> {
  return fetchJson<AlumnoDetalle>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function editarAlumno(id: number, cambios: AlumnoEditar): Promise<AlumnoDetalle> {
  return fetchJson<AlumnoDetalle>(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
}
