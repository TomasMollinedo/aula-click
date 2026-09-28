import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnosListadoResponse, ListarAlumnosParams } from '../alumnos.types'
import { listarAlumnos } from '../api/alumnos.api'
import { alumnosKeys } from '../api/alumnos.keys'

export function useAlumnos(params: ListarAlumnosParams, enabled = true) {
  return useQuery<AlumnosListadoResponse, ApiError>({
    queryKey: alumnosKeys.list(params),
    queryFn: () => listarAlumnos(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}
