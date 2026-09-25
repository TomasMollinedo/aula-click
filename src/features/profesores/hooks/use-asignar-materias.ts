import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarMaterias } from '@/features/materias/hooks/use-invalidar-materias'
import type { ApiError } from '@/utils/fetch-json'

import type { MateriaAsignada } from '../profesores.types'
import { asignarMaterias } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/**
 * Asigna una o varias materias al profesor (`POST /profesores/{id}/materias`), todas o ninguna.
 * Invalida sus materias asignadas y, como de otra feature solo se usan sus hooks, el detalle de
 * materias por el hook que expone `features/materias` (docs/sprints/sprint-1.md → T-12).
 */
export function useAsignarMaterias(profesorId: number) {
  const queryClient = useQueryClient()
  const invalidarMaterias = useInvalidarMaterias()
  return useMutation<MateriaAsignada[], ApiError, number[]>({
    mutationFn: (materiaIds) => asignarMaterias(profesorId, materiaIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.materias(profesorId) })
      void invalidarMaterias()
    },
  })
}
