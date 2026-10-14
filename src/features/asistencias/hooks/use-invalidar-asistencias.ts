import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { asistenciasKeys } from '../api/asistencias.keys'

/**
 * Vuelve a pedir lo que la cache sabe de asistencias. Lo usan las mutaciones de otras features que
 * las afectan: de otra feature solo se usan sus hooks.
 */
export function useInvalidarAsistencias() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: asistenciasKeys.all }),
    [queryClient],
  )
}
