import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorDetalle } from '../profesores.types'
import { reactivarProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useReactivarProfesor(id: number) {
  const queryClient = useQueryClient()

  return useMutation<ProfesorDetalle, ApiError, void>({
    mutationFn: () => reactivarProfesor(id),
    onSuccess: (data) => {
      queryClient.setQueryData(profesoresKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })
}
