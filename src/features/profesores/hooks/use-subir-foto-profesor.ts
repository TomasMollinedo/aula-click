import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorDetalle } from '../profesores.types'
import { subirFotoProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useSubirFotoProfesor(id: number) {
  const queryClient = useQueryClient()

  return useMutation<ProfesorDetalle, ApiError, File>({
    mutationFn: (foto) => subirFotoProfesor(id, foto),
    onSuccess: (data) => {
      queryClient.setQueryData(profesoresKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })
}
