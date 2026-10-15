import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Habilitacion } from '../mis-turnos.types'
import { obtenerHabilitacion } from '../api/mis-turnos.api'
import { misTurnosKeys } from '../api/mis-turnos.keys'

/**
 * Si el alumno de la sesión puede sacar un turno (deuda vencida, HU-29). Se consulta al entrar a
 * "Sacar turno", antes del paso 1; el alta lo vuelve a decidir al confirmar.
 */
export function useMiHabilitacion() {
  return useQuery<Habilitacion, ApiError>({
    queryKey: misTurnosKeys.habilitacion(),
    queryFn: obtenerHabilitacion,
    // Siempre lo actual al entrar: un pago en la mesa puede haberlo habilitado.
    staleTime: 0,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
