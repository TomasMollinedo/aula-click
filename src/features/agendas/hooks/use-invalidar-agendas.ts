import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { agendasKeys } from '../api/agendas.keys'

/**
 * Vuelve a pedir todas las agendas en cache (diaria, propia, de un profesor y el calendario). Lo
 * usan las mutaciones de otras features que cambian qué hay en una agenda (alta, cancelación,
 * finalización, reprogramación, pago): de otra feature solo se usan sus hooks.
 */
export function useInvalidarAgendas() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: agendasKeys.all }),
    [queryClient],
  )
}
