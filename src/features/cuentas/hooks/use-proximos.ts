import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ListarGlobalParams, ProximosGlobal } from '../cuentas.types'
import { listarProximos } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Página de próximos turnos de la vista global "Pagos", con el tope de cobro de la API. Como
 * `useAdeudados`: conserva la página anterior mientras llega la nueva (`keepPreviousData`), y
 * mientras `isPlaceholderData` la pantalla la atenúa y no deja tildar ni cobrar.
 */
export function useProximos(params: ListarGlobalParams) {
  return useQuery<ProximosGlobal, ApiError>({
    queryKey: cuentasKeys.proximosLista(params),
    queryFn: () => listarProximos(params),
    placeholderData: keepPreviousData,
    // Un 4xx (alumno del filtro inexistente, período inválido, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
