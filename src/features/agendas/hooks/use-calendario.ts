import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { FiltrosAgenda } from '@/types/agenda'
import type { ApiError } from '@/utils/fetch-json'

import type { CalendarioItem, OrigenAgenda } from '../agendas.types'
import { listarCalendario } from '../api/calendario.api'
import { agendasKeys } from '../api/agendas.keys'
import { paramsDelCalendario } from '../calendario'

/**
 * Las ocurrencias de una semana para el calendario (HU-19), del centro, de un profesor o del
 * profesor de la sesión según `origen`. Los filtros de la URL viajan a la API, que es quien decide
 * qué ocurrencias quedan.
 *
 * Conserva la semana anterior mientras llega la nueva (`keepPreviousData`), así pasar de semana no
 * deja la grilla en blanco; el calendario la muestra atenuada mientras tanto.
 */
export function useCalendario({
  origen,
  rango,
  filtros,
}: {
  origen: OrigenAgenda
  rango: { desde: string; hasta: string }
  filtros: FiltrosAgenda
}) {
  const params = paramsDelCalendario(origen, rango, filtros)

  return useQuery<CalendarioItem[], ApiError>({
    queryKey: agendasKeys.calendario(params),
    queryFn: () => listarCalendario(params),
    placeholderData: keepPreviousData,
    // Un 4xx (rango inválido, sin permiso, profesor inexistente o sin ficha) no cambia
    // reintentando: se muestra enseguida. Solo se reintenta un error del servidor o de red.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
