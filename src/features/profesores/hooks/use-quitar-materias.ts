import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarMaterias } from '@/features/materias/hooks/use-invalidar-materias'
import type { ApiError } from '@/utils/fetch-json'

import type { MateriaAsignada } from '../profesores.types'
import { quitarMaterias } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/**
 * Baja lógica de una o varias asignaciones del profesor (`DELETE /profesores/{id}/materias`),
 * todas o ninguna. Se permite con el profesor inactivo. Invalida sus materias asignadas y, como de
 * otra feature solo se usan sus hooks, el detalle de materias por el hook de `features/materias`.
 */
export function useQuitarMaterias(profesorId: number) {
  const queryClient = useQueryClient()
  const invalidarMaterias = useInvalidarMaterias()
  return useMutation<MateriaAsignada[], ApiError, number[]>({
    mutationFn: (materiaIds) => quitarMaterias(profesorId, materiaIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.materias(profesorId) })
      void invalidarMaterias()
    },
  })
}
