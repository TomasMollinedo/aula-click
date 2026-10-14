import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { anulacionesKeys } from '../api/anulaciones.keys'

/**
 * Vuelve a pedir lo que la cache sabe de anulaciones. Lo usan las mutaciones de otras features
 * que las afectan: de otra feature solo se usan sus hooks.
 */
export function useInvalidarAnulaciones() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: anulacionesKeys.all }),
    [queryClient],
  )
}
