import { fetchJson } from '@/utils/fetch-json'

import type {
  BloqueDisponible,
  DisponibilidadParams,
  TurnoCrear,
  TurnoDetalle,
  TurnosAlta,
} from '../turnos.types'

const BASE = '/api/v1/turnos'

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
