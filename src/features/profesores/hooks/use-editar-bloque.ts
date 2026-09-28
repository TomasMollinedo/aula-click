import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Bloque, BloqueEditar } from '../profesores.types'
import { editarBloque } from '../api/profesores.api'
import { useInvalidarHorario } from './use-invalidar-horario'

/** Edita una hora del horario (día, horario y/o aula). No muestra toasts. */
export function useEditarBloque(profesorId: number) {
  const invalidarHorario = useInvalidarHorario(profesorId)
  return useMutation<Bloque, ApiError, { bloqueId: number; cambios: BloqueEditar }>({
    mutationFn: ({ bloqueId, cambios }) => editarBloque(bloqueId, cambios),
    onSuccess: () => void invalidarHorario(),
  })
}
