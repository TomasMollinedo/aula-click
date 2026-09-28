import { fetchJson } from '@/utils/fetch-json'

import type {
  ListarMateriasParams,
  MateriaCrear,
  MateriaDetalle,
  MateriaSelectorItem,
  MateriasListadoResponse,
} from '../materias.types'

const BASE = '/api/v1/materias'

export function listarMaterias(params: ListarMateriasParams): Promise<MateriasListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.q) searchParams.set('q', params.q)
  if (params.estado) searchParams.set('estado', params.estado)

  const qs = searchParams.toString()
  return fetchJson<MateriasListadoResponse>(qs ? `${BASE}?${qs}` : BASE)
}

/** Materias activas ordenadas por nombre, sin paginar (docs/contrato-api.md → Selectores de catálogo). */
export function listarSelectorMaterias(): Promise<MateriaSelectorItem[]> {
  return fetchJson<MateriaSelectorItem[]>(`${BASE}/selector`)
}

export function obtenerMateria(id: number): Promise<MateriaDetalle> {
  return fetchJson<MateriaDetalle>(`${BASE}/${id}`)
}

export function crearMateria(datos: MateriaCrear): Promise<MateriaDetalle> {
  return fetchJson<MateriaDetalle>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

/** Baja lógica: pasa a INACTIVO. No se puede si tiene profesores asignados (409). */
export function darDeBajaMateria(id: number): Promise<MateriaDetalle> {
  return fetchJson<MateriaDetalle>(`${BASE}/${id}/baja`, { method: 'PATCH' })
}
