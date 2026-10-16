import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { PaginatedResponse } from '@/types'
import type { ApiError } from '@/utils/fetch-json'

import { listarMisPagos } from '../api/mis-pagos.api'
import { pagosKeys } from '../api/pagos.keys'
import type { MiPago } from '../pagos.types'

/**
 * Los pagos del alumno de la sesión, una página (portal, HU-37). Al cambiar de página se sigue
 * viendo la anterior mientras llega la nueva (`isPlaceholderData`).
 */
export function useMisPagos(page: number) {
  return useQuery<PaginatedResponse<MiPago>, ApiError>({
    queryKey: pagosKeys.misPagos(page),
    queryFn: () => listarMisPagos(page),
    placeholderData: keepPreviousData,
  })
}
