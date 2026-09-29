import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Centro } from '../centro.types'
import { obtenerCentro } from '../api/centro.api'
import { centroKeys } from '../api/centro.keys'

/**
 * Datos del centro para el encabezado de `DocumentoOficial`. Casi no cambian (los carga el seed),
 * así que se piden una vez por sesión de la pestaña.
 */
export function useCentro() {
  return useQuery<Centro, ApiError>({
    queryKey: centroKeys.all,
    queryFn: obtenerCentro,
    staleTime: Infinity,
  })
}
