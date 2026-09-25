import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaAsignada } from '../profesores.types'
import { listarMisMaterias } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/**
 * Materias del profesor de la sesión. La usa el filtro de materia de "Mis alumnos"
 * (`features/alumnos`, que solo puede consumir el hook de esta feature, no su `api/`).
 */
export function useMisMaterias() {
  return useQuery<MateriaAsignada[], ApiError>({
    queryKey: profesoresKeys.misMaterias(),
    queryFn: listarMisMaterias,
  })
}
