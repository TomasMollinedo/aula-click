import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AgendaPropiaItem, AgendaPropiaParams } from '../turnos.types'
import { listarAgendaPropia } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

/**
 * Agenda del profesor de la sesión para un rango de fechas (HU-10). El profesor sale de la sesión:
 * no se le pasa ningún id.
 *
 * Conserva la agenda anterior mientras llega la nueva (`keepPreviousData`), así navegar entre días
 * o semanas no deja la tabla en blanco; la pantalla la muestra atenuada mientras tanto.
 */
export function useAgendaPropia(params: AgendaPropiaParams) {
  return useQuery<AgendaPropiaItem[], ApiError>({
    queryKey: turnosKeys.agendaPropia(params),
    queryFn: () => listarAgendaPropia(params),
    placeholderData: keepPreviousData,
    // Un 4xx (rango inválido, sin permiso, sin ficha de profesor) no cambia reintentando: se
    // muestra enseguida. Solo se reintenta un error del servidor o de red.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
