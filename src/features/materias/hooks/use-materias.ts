import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ListarMateriasParams, MateriasListadoResponse } from '../materias.types'
import { listarMaterias } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

export function useMaterias(params: ListarMateriasParams, enabled = true) {
  return useQuery<MateriasListadoResponse, ApiError>({
    queryKey: materiasKeys.list(params),
    queryFn: () => listarMaterias(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}
