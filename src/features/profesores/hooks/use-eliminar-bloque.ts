import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Bloque } from '../profesores.types'
import { eliminarBloque } from '../api/profesores.api'
import { useInvalidarHorario } from './use-invalidar-horario'

/** Da de baja una hora del horario. No muestra toasts. */
export function useEliminarBloque(profesorId: number) {
  const invalidarHorario = useInvalidarHorario(profesorId)
  return useMutation<Bloque, ApiError, number>({
    mutationFn: (bloqueId) => eliminarBloque(bloqueId),
    onSuccess: () => void invalidarHorario(),
  })
}
