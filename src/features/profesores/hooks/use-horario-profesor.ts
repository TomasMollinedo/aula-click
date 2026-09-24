import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloqueHorario } from '../profesores.types'
import { listarHorarioProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/** Horario semanal del profesor: una fila por hora, con capacidad efectiva y ocupación. */
export function useHorarioProfesor(profesorId: number) {
  return useQuery<BloqueHorario[], ApiError>({
    queryKey: profesoresKeys.horario(profesorId),
    queryFn: () => listarHorarioProfesor(profesorId),
    enabled: profesorId > 0,
  })
}
