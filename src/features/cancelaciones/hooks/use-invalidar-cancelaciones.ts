import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { cancelacionesKeys } from '../api/cancelaciones.keys'

/**
 * Vuelve a pedir lo que la cache sabe de cancelaciones. Lo usan las mutaciones de otras features
 * que las afectan (por ejemplo, anular un pago): de otra feature solo se usan sus hooks.
 */
export function useInvalidarCancelaciones() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: cancelacionesKeys.all }),
    [queryClient],
  )
}
