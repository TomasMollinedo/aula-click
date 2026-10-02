import { fetchJson } from '@/utils/fetch-json'

import type { AgendaCentroParams, CalendarioItem, CalendarioParams } from '../agendas.types'
import { listarAgendaPropia, listarAgendaProfesor } from './agendas.api'

/**
 * Agenda del centro para un rango (HU-19): las ocurrencias de todos los profesores, sin paginar
 * (`desde` y `hasta` son obligatorios y el rango no pasa de 31 días).
 */
export function listarAgendaCentro(params: AgendaCentroParams): Promise<CalendarioItem[]> {
  const searchParams = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))
  if (params.incluirCancelados) searchParams.set('incluirCancelados', 'true')
  if (params.prioridad) searchParams.set('prioridad', params.prioridad)

  return fetchJson<CalendarioItem[]>(`/api/v1/agendas/centro?${searchParams.toString()}`)
}

/**
 * Las ocurrencias de una semana según de dónde salgan los turnos: el centro, un profesor o el
 * profesor de la sesión. Los tres endpoints devuelven un arreglo ordenado por fecha y hora.
 */
export function listarCalendario(params: CalendarioParams): Promise<CalendarioItem[]> {
  const { origen, ...consulta } = params
  switch (origen.tipo) {
    case 'centro':
      return listarAgendaCentro(consulta)
    case 'profesor':
      return listarAgendaProfesor({ ...consulta, profesorId: origen.profesorId })
    case 'propia':
      return listarAgendaPropia(consulta)
  }
}
