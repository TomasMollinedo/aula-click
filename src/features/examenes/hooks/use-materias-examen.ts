import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarMateriasExamen } from '../api/examenes.api'
import { examenesKeys } from '../api/examenes.keys'
import type { MateriaExamen } from '../examenes.types'

/**
 * Materias en las que quien está logueado puede cargarle un examen nuevo a ese alumno
 * (`GET /examenes/materias?alumnoId`): las de sus turnos activos de hoy en adelante; para el
 * profesor, solo las de los turnos que tiene con él.
 */
export function useMateriasExamen(alumnoId: number) {
  return useQuery<MateriaExamen[], ApiError>({
    queryKey: examenesKeys.materias(alumnoId),
    queryFn: () => listarMateriasExamen(alumnoId),
  })
}
