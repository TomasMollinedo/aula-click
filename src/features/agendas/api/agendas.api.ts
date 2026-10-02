import { fetchJson } from '@/utils/fetch-json'

import type {
  AgendaListadoParams,
  AgendaListadoResponse,
  AgendaProfesorParams,
  AgendaPropiaItem,
  AgendaPropiaParams,
  FiltrosEstadoPrioridadParams,
} from '../agendas.types'

const BASE = '/api/v1/agendas'

// `incluirCancelados` y `prioridad` los aceptan las cuatro agendas y se combinan con los demás filtros.
function agregarFiltros(searchParams: URLSearchParams, params: FiltrosEstadoPrioridadParams) {
  if (params.incluirCancelados) searchParams.set('incluirCancelados', 'true')
  if (params.prioridad) searchParams.set('prioridad', params.prioridad)
}

/** Agenda diaria del centro, paginada (HU-09). */
export function listarAgenda(params: AgendaListadoParams): Promise<AgendaListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.fecha) searchParams.set('fecha', params.fecha)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))
  agregarFiltros(searchParams, params)

  const qs = searchParams.toString()
  return fetchJson<AgendaListadoResponse>(qs ? `${BASE}/diaria?${qs}` : `${BASE}/diaria`)
}

/**
 * Agenda del profesor de la sesión (HU-10). El profesor no es un parámetro: lo resuelve la API con
 * la sesión, así que no hay forma de pedir la agenda de otro.
 */
export function listarAgendaPropia(params: AgendaPropiaParams): Promise<AgendaPropiaItem[]> {
  const searchParams = new URLSearchParams()
  if (params.desde) searchParams.set('desde', params.desde)
  if (params.hasta) searchParams.set('hasta', params.hasta)
  agregarFiltros(searchParams, params)

  const qs = searchParams.toString()
  return fetchJson<AgendaPropiaItem[]>(qs ? `${BASE}/propia?${qs}` : `${BASE}/propia`)
}

/** Agenda de un profesor cualquiera para mesa de entradas (ficha del profesor, HU-02). */
export function listarAgendaProfesor(params: AgendaProfesorParams): Promise<AgendaPropiaItem[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('profesorId', String(params.profesorId))
  if (params.desde) searchParams.set('desde', params.desde)
  if (params.hasta) searchParams.set('hasta', params.hasta)
  agregarFiltros(searchParams, params)

  return fetchJson<AgendaPropiaItem[]>(`${BASE}/profesor?${searchParams.toString()}`)
}
