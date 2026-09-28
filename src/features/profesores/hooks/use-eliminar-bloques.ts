import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloquesLote } from '../profesores.types'
import { eliminarBloques } from '../api/profesores.api'
import { useInvalidarHorario } from './use-invalidar-horario'

/** Da de baja un bloque completo (las horas que la UI muestra agrupadas), todo o nada. */
export function useEliminarBloques(profesorId: number) {
  const invalidarHorario = useInvalidarHorario(profesorId)
  return useMutation<BloquesLote, ApiError, number[]>({
    mutationFn: (bloqueIds) => eliminarBloques(bloqueIds),
    onSuccess: () => void invalidarHorario(),
  })
}
