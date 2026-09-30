import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaDetalle } from '../materias.types'
import { reactivarMateria } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

/**
 * Reactivación de una materia. Si no tiene precio la API responde 409 `MATERIA_SIN_PRECIO`: primero
 * hay que cargarlo con la edición.
 */
export function useReactivarMateria() {
  const queryClient = useQueryClient()

  return useMutation<MateriaDetalle, ApiError, number>({
    mutationFn: reactivarMateria,
    onSuccess: (materia) => {
      queryClient.setQueryData(materiasKeys.detail(materia.id), materia)
      void queryClient.invalidateQueries({ queryKey: materiasKeys.lists() })
      // Reactivada vuelve a ser elegible: aparece en los dropdowns de otras features.
      void queryClient.invalidateQueries({ queryKey: materiasKeys.selector() })
    },
  })
}
