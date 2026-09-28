import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AgendaListadoParams, AgendaListadoResponse } from '../turnos.types'
import { listarAgenda } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

export function useAgenda(params: AgendaListadoParams) {
  return useQuery<AgendaListadoResponse, ApiError>({
    queryKey: turnosKeys.agenda(params),
    queryFn: () => listarAgenda(params),
    placeholderData: keepPreviousData,
  })
}
