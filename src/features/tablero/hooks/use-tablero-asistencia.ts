import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerTableroAsistencia } from '../api/tablero.api'
import { tableroKeys } from '../api/tablero.keys'
import type { ParamsAsistencia, TableroAsistencia } from '../tablero.types'

/**
 * La sección "Asistencia" de un período (HU-39): el resumen y las dos tablas. Como en "General",
 * conserva la respuesta anterior mientras llega la nueva (`keepPreviousData`), así cambiar de
 * página o de orden no vacía la tabla; la pantalla la atenúa mientras `isPlaceholderData`.
 *
 * `habilitada` es `false` cuando la pestaña que se ve es "General": sólo pide la sección activa.
 */
export function useTableroAsistencia(params: ParamsAsistencia, habilitada = true) {
  return useQuery<TableroAsistencia, ApiError>({
    queryKey: tableroKeys.asistencia(params),
    queryFn: () => obtenerTableroAsistencia(params),
    enabled: habilitada,
    placeholderData: keepPreviousData,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
