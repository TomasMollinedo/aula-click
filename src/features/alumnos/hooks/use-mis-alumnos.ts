import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnosDeProfesorListadoResponse, ListarMisAlumnosParams } from '../alumnos.types'
import { listarMisAlumnos } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useMisAlumnos(params: ListarMisAlumnosParams, enabled = true) {
  return useQuery<AlumnosDeProfesorListadoResponse, ApiError>({
    queryKey: alumnosKeys.misAlumnos(params),
    queryFn: () => listarMisAlumnos(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}
