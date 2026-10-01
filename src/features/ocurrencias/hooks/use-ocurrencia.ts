import { useQuery } from '@tanstack/react-query'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { obtenerOcurrencia } from '../api/ocurrencias.api'
import { ocurrenciasKeys } from '../api/ocurrencias.keys'
import type { ObtenerOcurrenciaParams } from '../ocurrencias.types'

/** Detalle de una ocurrencia (`?detalle=<turnoId>&fecha=`). */
export function useOcurrencia(params: ObtenerOcurrenciaParams) {
  return useQuery<OcurrenciaDetalle, ApiError>({
    queryKey: ocurrenciasKeys.detalle(params),
    queryFn: () => obtenerOcurrencia(params),
  })
}
