import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useInvalidarAulas } from '@/features/aulas/hooks/use-invalidar-aulas'

import { profesoresKeys } from '../api/profesores.keys'

/**
 * Lo que invalida cualquier cambio en los bloques del profesor o en su ocupación: su horario, los
 * detalles de sus horas (estado, auditoría, ocupación) y las aulas disponibles (la ocupación de un
 * aula cambia con cada alta, edición o baja). Recibe el profesor al invocarla, para quien lo
 * conoce recién al guardar (el alta de turnos, T-33: el horario muestra la ocupación).
 */
export function useInvalidarHorarioDe() {
  const queryClient = useQueryClient()
  const invalidarAulas = useInvalidarAulas()
  return useCallback(
    (profesorId: number) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profesoresKeys.horario(profesorId) }),
        queryClient.invalidateQueries({ queryKey: profesoresKeys.bloques() }),
        invalidarAulas(),
      ]),
    [queryClient, invalidarAulas],
  )
}

/**
 * `useInvalidarHorarioDe` con el profesor fijo al renderizar. Lo comparten las mutaciones de
 * bloques para no repetirlo.
 */
export function useInvalidarHorario(profesorId: number) {
  const invalidarHorarioDe = useInvalidarHorarioDe()
  return useCallback(() => invalidarHorarioDe(profesorId), [invalidarHorarioDe, profesorId])
}
