import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ListarProfesoresParams, ProfesoresListadoResponse } from '../profesores.types'
import { listarProfesores } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useProfesores(params: ListarProfesoresParams, enabled = true) {
  return useQuery<ProfesoresListadoResponse, ApiError>({
    queryKey: profesoresKeys.list(params),
    queryFn: () => listarProfesores(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}
