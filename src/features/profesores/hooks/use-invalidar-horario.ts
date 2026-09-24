import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useInvalidarAulas } from '@/features/aulas/hooks/use-invalidar-aulas'

import { profesoresKeys } from '../api/profesores.keys'

/**
 * Lo que invalida cualquier cambio en los bloques del profesor: su horario, los detalles de sus
 * horas (estado, auditoría) y las aulas disponibles
 * (la ocupación de un aula cambia con cada alta, edición o baja). Lo comparten las mutaciones de
 * bloques para no repetirlo.
 */
export function useInvalidarHorario(profesorId: number) {
  const queryClient = useQueryClient()
  const invalidarAulas = useInvalidarAulas()
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profesoresKeys.horario(profesorId) }),
        queryClient.invalidateQueries({ queryKey: profesoresKeys.bloques() }),
        invalidarAulas(),
      ]),
    [queryClient, invalidarAulas, profesorId],
  )
}
