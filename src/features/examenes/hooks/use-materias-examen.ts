import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarMateriasExamen } from '../api/examenes.api'
import { examenesKeys } from '../api/examenes.keys'
import type { MateriaExamen } from '../examenes.types'

/**
 * Materias en las que quien está logueado puede cargarle un examen a ese alumno
 * (`GET /examenes/materias?alumnoId`). Para el profesor son solo las que le dicta.
 */
export function useMateriasExamen(alumnoId: number) {
  return useQuery<MateriaExamen[], ApiError>({
    queryKey: examenesKeys.materias(alumnoId),
    queryFn: () => listarMateriasExamen(alumnoId),
  })
}
