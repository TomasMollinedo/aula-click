import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { pagosKeys } from '../api/pagos.keys'

/**
 * Vuelve a pedir lo que la cache sabe de pagos. Lo usan las mutaciones de otras features que los
 * afectan: de otra feature solo se usan sus hooks.
 */
export function useInvalidarPagos() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: pagosKeys.all }),
    [queryClient],
  )
}
