import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarPagosRealizados } from '../api/pagos-realizados.api'
import { pagosKeys } from '../api/pagos.keys'
import type { ListadoPagosRealizados, ListarPagosRealizadosParams } from '../pagos-realizados.types'

/**
 * Los pagos realizados del filtro (HU-36). Con `keepPreviousData`, la página anterior sigue en
 * pantalla (atenuada, `isPlaceholderData`) mientras llega la del filtro nuevo. Su key cuelga de
 * `pagosKeys.all`: registrar, anular o cambiar el adjunto de un pago la vuelve a pedir.
 */
export function usePagosRealizados(params: ListarPagosRealizadosParams) {
  return useQuery<ListadoPagosRealizados, ApiError>({
    queryKey: pagosKeys.realizados(params),
    queryFn: () => listarPagosRealizados(params),
    placeholderData: keepPreviousData,
  })
}
