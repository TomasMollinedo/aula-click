import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoDetalle } from '../alumnos.types'
import { subirFotoAlumno } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

/**
 * Sube o reemplaza la foto. Toma el id como variable (y no al crear el hook) porque el alta la sube
 * recién después de crear al alumno, cuando recién se conoce el id; la edición pasa el suyo.
 */
export function useSubirFotoAlumno() {
  const queryClient = useQueryClient()

  return useMutation<AlumnoDetalle, ApiError, { id: number; foto: File }>({
    mutationFn: ({ id, foto }) => subirFotoAlumno(id, foto),
    onSuccess: (data) => {
      queryClient.setQueryData(alumnosKeys.detail(data.id), data)
      void queryClient.invalidateQueries({ queryKey: alumnosKeys.lists() })
    },
  })
}
