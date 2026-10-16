import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMisIngresos } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { MisIngresos } from '../liquidaciones.types'

/** "Mis ingresos" del profesor de la sesión: el mes en curso y sus clases (T-126). */
export function useMisIngresos() {
  return useQuery<MisIngresos, ApiError>({
    queryKey: liquidacionesKeys.misIngresos(),
    queryFn: obtenerMisIngresos,
    // Un 403 (sin ficha de profesor) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
