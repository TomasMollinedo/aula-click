import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AgendaProfesorParams, AgendaPropiaItem } from '../turnos.types'
import { listarAgendaProfesor } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

/**
 * Agenda de un profesor para mesa de entradas (ficha del profesor, HU-02), para un rango de fechas.
 * Misma configuración que `useAgendaPropia`: conserva la agenda anterior mientras llega la nueva.
 */
export function useAgendaProfesor(params: AgendaProfesorParams) {
  return useQuery<AgendaPropiaItem[], ApiError>({
    queryKey: turnosKeys.agendaProfesor(params),
    queryFn: () => listarAgendaProfesor(params),
    placeholderData: keepPreviousData,
    // Un 4xx (rango inválido, sin permiso, profesor inexistente) no cambia reintentando.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
