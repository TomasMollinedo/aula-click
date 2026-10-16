import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerLiquidacionesDelMes } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { LiquidacionesDelMes, ListarLiquidacionesDelMesParams } from '../liquidaciones.types'

/**
 * Las liquidaciones de un mes. Conserva las del mes anterior mientras llegan las nuevas
 * (`keepPreviousData`): la pantalla rotula con `data.mes` (el que devolvió la API) y las atenúa
 * mientras `isPlaceholderData`.
 */
export function useLiquidacionesDelMes(params: ListarLiquidacionesDelMesParams) {
  return useQuery<LiquidacionesDelMes, ApiError>({
    queryKey: liquidacionesKeys.delMes(params),
    queryFn: () => obtenerLiquidacionesDelMes(params),
    placeholderData: keepPreviousData,
    // Un 4xx (mes futuro, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
