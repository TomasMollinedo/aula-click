import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerLiquidacion } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { LiquidacionDetalle } from '../liquidaciones.types'

/** La liquidación de un profesor en un mes (vista del gerente). */
export function useLiquidacion(profesorId: string, mes: string) {
  return useQuery<LiquidacionDetalle, ApiError>({
    queryKey: liquidacionesKeys.detalle(profesorId, mes),
    queryFn: () => obtenerLiquidacion({ profesorId, mes }),
    // Un 4xx (id o mes inválido, profesor inexistente, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
