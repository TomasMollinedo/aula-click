import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AdeudadosGlobal, ListarAdeudadosParams } from '../cuentas.types'
import { listarAdeudados } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Página de adeudados de la vista global "Pagos". Conserva la página anterior mientras llega la
 * nueva (`keepPreviousData`), para que la tabla no parpadee al paginar.
 */
export function useAdeudados(params: ListarAdeudadosParams) {
  return useQuery<AdeudadosGlobal, ApiError>({
    queryKey: cuentasKeys.adeudadosLista(params),
    queryFn: () => listarAdeudados(params),
    placeholderData: keepPreviousData,
    // Un 4xx (alumno del filtro inexistente, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
