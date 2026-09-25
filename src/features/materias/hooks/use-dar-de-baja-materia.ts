import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaDetalle } from '../materias.types'
import { darDeBajaMateria } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

/**
 * Baja lógica de una materia. Si tiene profesores asignados la API responde 409
 * `MATERIA_CON_PROFESORES` y no la da de baja: quien llama muestra los profesores de `details`.
 */
export function useDarDeBajaMateria() {
  const queryClient = useQueryClient()

  return useMutation<MateriaDetalle, ApiError, number>({
    mutationFn: darDeBajaMateria,
    onSuccess: (materia) => {
      queryClient.setQueryData(materiasKeys.detail(materia.id), materia)
      void queryClient.invalidateQueries({ queryKey: materiasKeys.lists() })
      // Dada de baja deja de ser elegible: se cae de los dropdowns de otras features.
      void queryClient.invalidateQueries({ queryKey: materiasKeys.selector() })
    },
  })
}
