import type { ListarAlumnosParams, ListarMisAlumnosParams } from '../alumnos.types'

export const alumnosKeys = {
  all: ['alumnos'] as const,
  lists: () => [...alumnosKeys.all, 'list'] as const,
  list: (params: ListarAlumnosParams) => [...alumnosKeys.lists(), params] as const,
  details: () => [...alumnosKeys.all, 'detail'] as const,
  detail: (id: number) => [...alumnosKeys.details(), id] as const,
  /** Alumnos del profesor de la sesión (`GET /alumnos/mis-alumnos`). */
  misAlumnos: (params: ListarMisAlumnosParams) =>
    [...alumnosKeys.all, 'mis-alumnos', params] as const,
}
