import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaAsignada } from '../profesores.types'
import { listarMateriasAsignadas } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/**
 * Materias con asignación activa del profesor. La usan la sección "Horario" (para saber si se le
 * pueden cargar bloques) y la sección "Materias" de la ficha; las mutaciones de asignar y quitar
 * materias invalidan `profesoresKeys.materias(id)`.
 */
export function useMateriasAsignadas(profesorId: number) {
  return useQuery<MateriaAsignada[], ApiError>({
    queryKey: profesoresKeys.materias(profesorId),
    queryFn: () => listarMateriasAsignadas(profesorId),
    enabled: profesorId > 0,
  })
}
