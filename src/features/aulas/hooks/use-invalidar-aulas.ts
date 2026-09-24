import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { aulasKeys } from '../api/aulas.keys'

/**
 * Invalida todo lo que la cache sabe de aulas (las disponibles de cualquier horario). Lo usan las
 * mutaciones de otras features que cambian la ocupación de un aula (los bloques del profesor):
 * de otra feature solo se usan sus hooks, así que las keys no salen de acá.
 */
export function useInvalidarAulas() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: aulasKeys.all }),
    [queryClient],
  )
}
