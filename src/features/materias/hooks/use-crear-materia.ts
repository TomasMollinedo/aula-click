import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaCrear, MateriaDetalle } from '../materias.types'
import { crearMateria } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

export function useCrearMateria() {
  const queryClient = useQueryClient()

  return useMutation<MateriaDetalle, ApiError, MateriaCrear>({
    mutationFn: crearMateria,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: materiasKeys.lists() })
      // La materia nueva está activa: tiene que aparecer en los dropdowns de otras features.
      void queryClient.invalidateQueries({ queryKey: materiasKeys.selector() })
    },
  })
}
