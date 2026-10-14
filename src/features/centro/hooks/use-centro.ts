import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Centro } from '../centro.types'
import { obtenerCentro } from '../api/centro.api'
import { centroKeys } from '../api/centro.keys'

/**
 * Datos del centro para la UI (el teléfono del aviso del portal, T-80). Casi no cambian (los carga
 * el seed), así que se piden una vez por sesión de la pestaña. Un error (por ejemplo el 403 del
 * alumno mientras `GET /centro` no le está abierto, T-91) no se reintenta: quien lo usa sigue sin
 * el dato.
 */
export function useCentro() {
  return useQuery<Centro, ApiError>({
    queryKey: centroKeys.all,
    queryFn: obtenerCentro,
    staleTime: Infinity,
    retry: false,
  })
}
