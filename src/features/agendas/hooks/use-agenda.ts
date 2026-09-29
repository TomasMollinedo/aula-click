import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AgendaListadoParams, AgendaListadoResponse } from '../agendas.types'
import { listarAgenda } from '../api/agendas.api'
import { agendasKeys } from '../api/agendas.keys'

export function useAgenda(params: AgendaListadoParams) {
  return useQuery<AgendaListadoResponse, ApiError>({
    queryKey: agendasKeys.diaria(params),
    queryFn: () => listarAgenda(params),
    placeholderData: keepPreviousData,
  })
}
