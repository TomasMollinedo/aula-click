import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoCrear, AlumnoDetalle } from '../alumnos.types'
import { crearAlumno } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useCrearAlumno() {
  const queryClient = useQueryClient()

  return useMutation<AlumnoDetalle, ApiError, AlumnoCrear>({
    mutationFn: crearAlumno,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alumnosKeys.lists() })
    },
  })
}
