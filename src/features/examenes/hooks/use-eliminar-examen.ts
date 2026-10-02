import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { eliminarExamen } from '../api/examenes.api'
import type { ExamenDetalle } from '../examenes.types'
import { useInvalidarExamenes } from './use-invalidar-examenes'
import { useRefrescarPorExamen } from './use-refrescar-por-examen'

/** Elimina (da de baja) un examen. Un 404 refresca la lista: otro ya lo había eliminado. */
export function useEliminarExamen() {
  const refrescar = useRefrescarPorExamen()
  const invalidarExamenes = useInvalidarExamenes()

  return useMutation<ExamenDetalle, ApiError, number>({
    mutationFn: eliminarExamen,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 404) void invalidarExamenes()
    },
  })
}
