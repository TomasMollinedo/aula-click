import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { OcurrenciaDelPortal } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { listarMisTurnos } from '../api/ocurrencias.api'
import { ocurrenciasKeys } from '../api/ocurrencias.keys'
import type { MisTurnosParams } from '../ocurrencias.types'

/**
 * Los turnos del alumno de la sesión en `[desde, hasta]` ("Mi calendario" del portal). Al pasar de
 * semana deja en pantalla los de la anterior mientras llegan los nuevos.
 */
export function useMisTurnos(params: MisTurnosParams) {
  return useQuery<OcurrenciaDelPortal[], ApiError>({
    queryKey: ocurrenciasKeys.misTurnos(params),
    queryFn: () => listarMisTurnos(params),
    placeholderData: keepPreviousData,
  })
}
