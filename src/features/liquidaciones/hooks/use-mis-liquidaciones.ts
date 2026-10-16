import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMisLiquidaciones } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { MisLiquidaciones } from '../liquidaciones.types'
import { REGISTROS_POR_PAGINA } from '../mis-ingresos'

/**
 * Las liquidaciones del profesor de la sesión, por página (T-126). Al cambiar de página deja la
 * anterior en pantalla mientras llega la nueva.
 */
export function useMisLiquidaciones(page: number) {
  return useQuery<MisLiquidaciones, ApiError>({
    queryKey: liquidacionesKeys.misLiquidaciones(page),
    queryFn: () => obtenerMisLiquidaciones(page, REGISTROS_POR_PAGINA),
    placeholderData: keepPreviousData,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
