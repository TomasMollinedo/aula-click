import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ocurrenciasKeys } from '../api/ocurrencias.keys'

/**
 * Vuelve a pedir el detalle de las ocurrencias y los turnos de un alumno en cache. Lo usan las
 * mutaciones de otras features que cambian una ocurrencia (alta, cancelación, finalización,
 * reprogramación, pago): de otra feature solo se usan sus hooks.
 */
export function useInvalidarOcurrencias() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ocurrenciasKeys.all }),
    [queryClient],
  )
}
