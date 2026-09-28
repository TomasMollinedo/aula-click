import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoDetalle, AlumnoEditar } from '../alumnos.types'
import { editarAlumno } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useEditarAlumno(id: number) {
  const queryClient = useQueryClient()

  return useMutation<AlumnoDetalle, ApiError, AlumnoEditar>({
    mutationFn: (cambios) => editarAlumno(id, cambios),
    onSuccess: (data) => {
      queryClient.setQueryData(alumnosKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: alumnosKeys.lists() })
    },
  })
}
