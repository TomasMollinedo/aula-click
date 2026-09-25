import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorDetalle } from '../profesores.types'
import { darDeBajaProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useDarDeBajaProfesor(id: number) {
  const queryClient = useQueryClient()

  return useMutation<ProfesorDetalle, ApiError, void>({
    mutationFn: () => darDeBajaProfesor(id),
    onSuccess: (data) => {
      queryClient.setQueryData(profesoresKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })
}
