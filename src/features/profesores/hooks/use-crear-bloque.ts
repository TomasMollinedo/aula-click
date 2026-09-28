import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloqueCrear, BloquesLote } from '../profesores.types'
import { crearBloque } from '../api/profesores.api'
import { useInvalidarHorario } from './use-invalidar-horario'

/** Carga un bloque (una fila por hora del rango, todas o ninguna). No muestra toasts. */
export function useCrearBloque(profesorId: number) {
  const invalidarHorario = useInvalidarHorario(profesorId)
  return useMutation<BloquesLote, ApiError, Omit<BloqueCrear, 'profesorId'>>({
    mutationFn: (datos) => crearBloque({ ...datos, profesorId }),
    onSuccess: () => void invalidarHorario(),
  })
}
