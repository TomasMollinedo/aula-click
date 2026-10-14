import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { historialesKeys } from '../api/historiales.keys'

/**
 * Vuelve a pedir lo que la cache sabe de historiales académicos. Lo usan las mutaciones de otras
 * features que los afectan: de otra feature solo se usan sus hooks.
 */
export function useInvalidarHistoriales() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: historialesKeys.all }),
    [queryClient],
  )
}
