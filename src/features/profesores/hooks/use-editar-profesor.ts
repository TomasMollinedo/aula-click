import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorDetalle, ProfesorEditar } from '../profesores.types'
import { editarProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useEditarProfesor(id: number) {
  const queryClient = useQueryClient()

  return useMutation<ProfesorDetalle, ApiError, ProfesorEditar>({
    mutationFn: (cambios) => editarProfesor(id, cambios),
    onSuccess: (data) => {
      queryClient.setQueryData(profesoresKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })
}
