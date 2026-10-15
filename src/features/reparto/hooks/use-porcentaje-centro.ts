import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerPorcentaje } from '../api/reparto.api'
import { repartoKeys } from '../api/reparto.keys'
import type { ObtenerPorcentajeParams, PorcentajeCentroConHistorial } from '../reparto.types'

/** El porcentaje vigente y una página del historial; conserva la anterior mientras llega otra. */
export function usePorcentajeCentro(params: ObtenerPorcentajeParams) {
  return useQuery<PorcentajeCentroConHistorial, ApiError>({
    queryKey: repartoKeys.porcentaje(params),
    queryFn: () => obtenerPorcentaje(params),
    placeholderData: keepPreviousData,
  })
}
