import { fetchJson } from '@/utils/fetch-json'

import type {
  ListarProfesoresParams,
  ProfesorCrear,
  ProfesorDetalle,
  ProfesorEditar,
  ProfesoresListadoResponse,
} from '../profesores.types'

const BASE = '/api/v1/profesores'

export function listarProfesores(
  params: ListarProfesoresParams,
): Promise<ProfesoresListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.q) searchParams.set('q', params.q)
  if (params.estado) searchParams.set('estado', params.estado)
  if (params.materiaId != null) searchParams.set('materiaId', String(params.materiaId))

  const qs = searchParams.toString()
  return fetchJson<ProfesoresListadoResponse>(qs ? `${BASE}?${qs}` : BASE)
}

export function obtenerProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}`)
}

export function crearProfesor(datos: ProfesorCrear): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function editarProfesor(id: number, cambios: ProfesorEditar): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
}

/** Multipart con un único campo `foto` (JPG o PNG, hasta 5 MB). Reemplaza la anterior si tenía. */
export function subirFotoProfesor(id: number, foto: File): Promise<ProfesorDetalle> {
  const formData = new FormData()
  formData.set('foto', foto)
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/foto`, {
    method: 'POST',
    body: formData,
  })
}

export function quitarFotoProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/foto`, { method: 'DELETE' })
}
