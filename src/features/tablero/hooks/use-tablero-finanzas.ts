import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerTableroFinanzas } from '../api/tablero.api'
import { tableroKeys } from '../api/tablero.keys'
import type { ParamsFinanzas, TableroFinanzas } from '../tablero.types'

/**
 * La sección "Finanzas" de un período (HU-47): el resumen, la tabla por profesor y la evolución de
 * los 6 meses. Como las otras dos secciones, conserva la respuesta anterior mientras llega la nueva
 * (`keepPreviousData`), así cambiar de página o de orden no vacía la tabla; la pantalla la atenúa
 * mientras `isPlaceholderData`.
 *
 * `habilitada` es `false` cuando la pestaña que se ve es otra: sólo pide la sección activa.
 */
export function useTableroFinanzas(params: ParamsFinanzas, habilitada = true) {
  return useQuery<TableroFinanzas, ApiError>({
    queryKey: tableroKeys.finanzas(params),
    queryFn: () => obtenerTableroFinanzas(params),
    enabled: habilitada,
    placeholderData: keepPreviousData,
    // Un 4xx (período inválido, un parámetro que no existe, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
