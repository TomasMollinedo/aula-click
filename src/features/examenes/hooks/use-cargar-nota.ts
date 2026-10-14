import { useMutation } from '@tanstack/react-query'

import { useInvalidarHistoriales } from '@/features/historiales/hooks/use-invalidar-historiales'
import type { ApiError } from '@/utils/fetch-json'

import { cargarNota } from '../api/examenes.api'
import type { ExamenDetalle, NotaCargar } from '../examenes.types'
import { useInvalidarExamenes } from './use-invalidar-examenes'

/**
 * Carga o corrige la nota de un examen (HU-34). Invalida los exámenes y los historiales (la nota se
 * ve en el historial académico). La prioridad de los turnos no depende de la nota: no se tocan
 * ocurrencias ni agendas. Un 404 o un 409 (`EXAMEN_FUTURO`) dicen que la lista tenía datos viejos.
 */
export function useCargarNota() {
  const invalidarExamenes = useInvalidarExamenes()
  const invalidarHistoriales = useInvalidarHistoriales()

  return useMutation<ExamenDetalle, ApiError, { id: number; datos: NotaCargar }>({
    mutationFn: ({ id, datos }) => cargarNota(id, datos),
    onSuccess: () => {
      void invalidarExamenes()
      void invalidarHistoriales()
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) void invalidarExamenes()
    },
  })
}
