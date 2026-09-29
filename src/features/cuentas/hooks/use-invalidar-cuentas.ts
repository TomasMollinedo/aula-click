import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Vuelve a pedir la deuda y los pagos de los alumnos en cache. Lo usan las mutaciones de otras
 * features que los cambian (registrar o anular un pago, cancelar un turno): de otra feature solo
 * se usan sus hooks.
 */
export function useInvalidarCuentas() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: cuentasKeys.all }),
    [queryClient],
  )
}
