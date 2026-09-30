import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaDetalle, MateriaEditar } from '../materias.types'
import { editarMateria } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

export function useEditarMateria(id: number) {
  const queryClient = useQueryClient()

  return useMutation<MateriaDetalle, ApiError, MateriaEditar>({
    mutationFn: (datos) => editarMateria(id, datos),
    onSuccess: (materia) => {
      queryClient.setQueryData(materiasKeys.detail(materia.id), materia)
      void queryClient.invalidateQueries({ queryKey: materiasKeys.lists() })
      // Un nombre nuevo cambia lo que muestran los dropdowns de otras features.
      void queryClient.invalidateQueries({ queryKey: materiasKeys.selector() })
    },
  })
}
