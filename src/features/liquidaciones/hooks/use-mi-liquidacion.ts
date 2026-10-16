import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMiLiquidacion } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { MiLiquidacionDetalle } from '../liquidaciones.types'

/** La liquidación del profesor de la sesión en un mes ("Mis ingresos"). */
export function useMiLiquidacion(mes: string) {
  return useQuery<MiLiquidacionDetalle, ApiError>({
    queryKey: liquidacionesKeys.miDetalle(mes),
    queryFn: () => obtenerMiLiquidacion(mes),
    // Un 4xx (mes inválido o futuro, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
