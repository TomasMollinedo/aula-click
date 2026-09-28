import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorCrear, ProfesorDetalle } from '../profesores.types'
import { crearProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useCrearProfesor() {
  const queryClient = useQueryClient()

  return useMutation<ProfesorDetalle, ApiError, ProfesorCrear>({
    mutationFn: crearProfesor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })
}
