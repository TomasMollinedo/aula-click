import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { editarExamen } from '../api/examenes.api'
import type { ExamenDetalle, ExamenEditar } from '../examenes.types'
import { useInvalidarExamenes } from './use-invalidar-examenes'
import { useRefrescarPorExamen } from './use-refrescar-por-examen'

/** Edición parcial de un examen. Un 404 o un 409 refrescan la lista: tenía datos viejos. */
export function useEditarExamen() {
  const refrescar = useRefrescarPorExamen()
  const invalidarExamenes = useInvalidarExamenes()

  return useMutation<ExamenDetalle, ApiError, { id: number; datos: ExamenEditar }>({
    mutationFn: ({ id, datos }) => editarExamen(id, datos),
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 404 || error.status === 409) void invalidarExamenes()
    },
  })
}
