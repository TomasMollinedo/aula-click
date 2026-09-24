import type { ListarMateriasParams } from '../materias.types'

export const materiasKeys = {
  all: ['materias'] as const,
  lists: () => [...materiasKeys.all, 'list'] as const,
  list: (params: ListarMateriasParams) => [...materiasKeys.lists(), params] as const,
  details: () => [...materiasKeys.all, 'detail'] as const,
  detail: (id: number) => [...materiasKeys.details(), id] as const,
  /** Materias activas para los dropdowns (`GET /materias/selector`). */
  selector: () => [...materiasKeys.all, 'selector'] as const,
}
