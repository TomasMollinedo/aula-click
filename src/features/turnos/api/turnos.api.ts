import { fetchJson } from '@/utils/fetch-json'

import type {
  AgendaListadoParams,
  AgendaListadoResponse,
  AgendaProfesorParams,
  AgendaPropiaItem,
  AgendaPropiaParams,
  BloqueDisponible,
  DisponibilidadParams,
  TurnoCrear,
  TurnoDetalle,
  TurnosAlta,
} from '../turnos.types'

const BASE = '/api/v1/turnos'

export function listarAgenda(params: AgendaListadoParams): Promise<AgendaListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.fecha) searchParams.set('fecha', params.fecha)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))

  const qs = searchParams.toString()
  return fetchJson<AgendaListadoResponse>(qs ? `${BASE}/agenda?${qs}` : `${BASE}/agenda`)
}

/**
 * Agenda del profesor de la sesión (HU-10). El profesor no es un parámetro: lo resuelve la API con
 * la sesión, así que no hay forma de pedir la agenda de otro.
 */
export function listarAgendaPropia(params: AgendaPropiaParams): Promise<AgendaPropiaItem[]> {
  const searchParams = new URLSearchParams()
  if (params.desde) searchParams.set('desde', params.desde)
  if (params.hasta) searchParams.set('hasta', params.hasta)

  const qs = searchParams.toString()
  return fetchJson<AgendaPropiaItem[]>(qs ? `${BASE}/agenda-propia?${qs}` : `${BASE}/agenda-propia`)
}

/** Agenda de un profesor cualquiera para mesa de entradas (ficha del profesor, HU-02). */
export function listarAgendaProfesor(params: AgendaProfesorParams): Promise<AgendaPropiaItem[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('profesorId', String(params.profesorId))
  if (params.desde) searchParams.set('desde', params.desde)
  if (params.hasta) searchParams.set('hasta', params.hasta)

  return fetchJson<AgendaPropiaItem[]>(`${BASE}/agenda-profesor?${searchParams.toString()}`)
}

export function buscarDisponibilidad(params: DisponibilidadParams): Promise<BloqueDisponible[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('materiaId', String(params.materiaId))
  if (params.diaSemana != null) searchParams.set('diaSemana', String(params.diaSemana))
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))
  if (params.fecha) searchParams.set('fecha', params.fecha)

  return fetchJson<BloqueDisponible[]>(`${BASE}/disponibilidad?${searchParams.toString()}`)
}

export function crearTurnos(datos: TurnoCrear): Promise<TurnosAlta> {
  return fetchJson<TurnosAlta>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function obtenerTurno(id: number): Promise<TurnoDetalle> {
  return fetchJson<TurnoDetalle>(`${BASE}/${id}`)
}
