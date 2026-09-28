import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { turnosKeys } from '../api/turnos.keys'

/**
 * Vuelve a pedir la disponibilidad (todas las búsquedas en cache): al volver a la búsqueda después
 * de un rechazo, lo que se ve tiene que ser lo actual.
 */
export function useInvalidarDisponibilidad() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: turnosKeys.disponibilidades() }),
    [queryClient],
  )
}
