import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoDetalle } from '../alumnos.types'
import { obtenerAlumno } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useAlumno(id: number) {
  return useQuery<AlumnoDetalle, ApiError>({
    queryKey: alumnosKeys.detail(id),
    queryFn: () => obtenerAlumno(id),
    enabled: id > 0,
  })
}
