import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { materiasKeys } from '../api/materias.keys'

/**
 * Invalida todo lo que la cache sabe de materias (el listado, los detalles y el selector). Lo usan
 * las mutaciones de otras features que cambian sus datos: asignar o quitar una materia a un
 * profesor (HU-04) cambia la lista de profesores del detalle de esa materia. De otra feature solo
 * se usan sus hooks, así que las keys no salen de acá.
 */
export function useInvalidarMaterias() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: materiasKeys.all }),
    [queryClient],
  )
}
