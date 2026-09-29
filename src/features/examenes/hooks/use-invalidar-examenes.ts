import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { examenesKeys } from '../api/examenes.keys'

/**
 * Vuelve a pedir los exámenes en cache. Lo usan las mutaciones de otras features que los afectan:
 * de otra feature solo se usan sus hooks.
 */
export function useInvalidarExamenes() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: examenesKeys.all }),
    [queryClient],
  )
}
