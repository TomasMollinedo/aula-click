import type { ListarAlumnosParams } from '../alumnos.types'

export const alumnosKeys = {
  all: ['alumnos'] as const,
  lists: () => [...alumnosKeys.all, 'list'] as const,
  list: (params: ListarAlumnosParams) => [...alumnosKeys.lists(), params] as const,
  details: () => [...alumnosKeys.all, 'detail'] as const,
  detail: (id: number) => [...alumnosKeys.details(), id] as const,
}
