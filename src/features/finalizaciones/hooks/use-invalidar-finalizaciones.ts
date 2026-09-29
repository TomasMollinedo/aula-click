import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { finalizacionesKeys } from '../api/finalizaciones.keys'

/**
 * Vuelve a pedir lo que la cache sabe de finalizaciones. Lo usan las mutaciones de otras features
 * que las afectan: de otra feature solo se usan sus hooks.
 */
export function useInvalidarFinalizaciones() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: finalizacionesKeys.all }),
    [queryClient],
  )
}
