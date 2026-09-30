import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarPreciosMaterias } from '../api/prueba-pagos.api'
import { pruebaPagosKeys } from '../api/prueba-pagos.keys'

// TEMPORAL (T-52): ver `api/prueba-pagos.api.ts`.
export function usePreciosMaterias() {
  return useQuery<Map<number, number | null>, ApiError>({
    queryKey: pruebaPagosKeys.precios(),
    queryFn: listarPreciosMaterias,
  })
}
