import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoDetalle } from '../alumnos.types'
import { quitarFotoAlumno } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useQuitarFotoAlumno(id: number) {
  const queryClient = useQueryClient()

  return useMutation<AlumnoDetalle, ApiError, void>({
    mutationFn: () => quitarFotoAlumno(id),
    onSuccess: (data) => {
      queryClient.setQueryData(alumnosKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: alumnosKeys.lists() })
    },
  })
}
