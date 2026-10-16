import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerCaja } from '../api/caja.api'
import { cajaKeys } from '../api/caja.keys'
import type { Caja, ListarCajaParams } from '../caja.types'

/**
 * La caja de un día, con sus filtros. Conserva la del día anterior mientras llega la nueva
 * (`keepPreviousData`): la pantalla rotula con `data.fecha` (la que devolvió la API, que sin
 * `fecha` es la de hoy en la zona del negocio) y atenúa lo que se ve mientras `isPlaceholderData`.
 */
export function useCaja(params: ListarCajaParams) {
  return useQuery<Caja, ApiError>({
    queryKey: cajaKeys.delDia(params),
    queryFn: () => obtenerCaja(params),
    placeholderData: keepPreviousData,
    // Un 4xx (fecha futura, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
