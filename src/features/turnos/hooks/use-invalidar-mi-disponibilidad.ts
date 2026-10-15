import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { misTurnosKeys } from '../api/mis-turnos.keys'

/**
 * Vuelve a pedir la disponibilidad del portal: al "Elegir otro horario" después de un rechazo, lo
 * que se ve tiene que ser lo actual.
 */
export function useInvalidarMiDisponibilidad() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: misTurnosKeys.disponibilidades() }),
    [queryClient],
  )
}
