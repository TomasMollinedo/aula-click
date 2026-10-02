import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerTablero } from '../api/tablero.api'
import { tableroKeys } from '../api/tablero.keys'
import type { PeriodoTablero, Tablero } from '../tablero.types'

/**
 * Los indicadores de un período. Conserva los del período anterior mientras llegan los nuevos
 * (`keepPreviousData`): las tarjetas rotulan cada número con `data.periodo` (el que devolvió la
 * API), así que lo viejo nunca se lee como del período nuevo; mientras `isPlaceholderData` la
 * pantalla lo atenúa.
 */
export function useTablero(periodo: PeriodoTablero) {
  return useQuery<Tablero, ApiError>({
    queryKey: tableroKeys.periodo(periodo),
    queryFn: () => obtenerTablero(periodo),
    placeholderData: keepPreviousData,
    // Un 4xx (período inválido, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
