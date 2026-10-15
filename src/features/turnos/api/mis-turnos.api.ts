import { fetchJson } from '@/utils/fetch-json'

import type {
  BloqueOfertado,
  Habilitacion,
  MateriaOfertada,
  MiDisponibilidadParams,
  MiTurnoCrear,
  MiTurnoReservado,
} from '../mis-turnos.types'

// "Sacar turno" del portal (rol ALUMNO). Ninguno manda `alumnoId`: es el de la sesión.
const BASE = '/api/v1/turnos/mis-turnos'

export function obtenerHabilitacion(): Promise<Habilitacion> {
  return fetchJson<Habilitacion>(`${BASE}/habilitacion`)
}

export function listarMisMaterias(): Promise<MateriaOfertada[]> {
  return fetchJson<MateriaOfertada[]>(`${BASE}/materias`)
}

export function buscarMiDisponibilidad(params: MiDisponibilidadParams): Promise<BloqueOfertado[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('materiaId', String(params.materiaId))
  if (params.diaSemana != null) searchParams.set('diaSemana', String(params.diaSemana))
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))
  if (params.fecha) searchParams.set('fecha', params.fecha)

  return fetchJson<BloqueOfertado[]>(`${BASE}/disponibilidad?${searchParams.toString()}`)
}

export function sacarTurno(datos: MiTurnoCrear): Promise<MiTurnoReservado> {
  return fetchJson<MiTurnoReservado>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
