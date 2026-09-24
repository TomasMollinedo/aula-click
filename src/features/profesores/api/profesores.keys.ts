import type { ListarProfesoresParams } from '../profesores.types'

export const profesoresKeys = {
  all: ['profesores'] as const,
  lists: () => [...profesoresKeys.all, 'list'] as const,
  list: (params: ListarProfesoresParams) => [...profesoresKeys.lists(), params] as const,
  details: () => [...profesoresKeys.all, 'detail'] as const,
  detail: (id: number) => [...profesoresKeys.details(), id] as const,
  /** Materias asignadas del profesor (`GET /profesores/{id}/materias`). */
  materias: (id: number) => [...profesoresKeys.all, 'materias', id] as const,
  /** Horario semanal del profesor (`GET /bloques?profesorId=`). */
  horario: (id: number) => [...profesoresKeys.all, 'horario', id] as const,
}
