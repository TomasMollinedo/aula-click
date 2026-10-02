import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { crearExamen } from '../api/examenes.api'
import type { ExamenCrear, ExamenDetalle } from '../examenes.types'
import { useInvalidarExamenes } from './use-invalidar-examenes'
import { useRefrescarPorExamen } from './use-refrescar-por-examen'

/**
 * Carga un examen. Un 409 (`EXAMEN_PENDIENTE`, `MATERIA_INACTIVA`) dice que la pantalla tenía datos
 * viejos: vuelve a pedir los exámenes, así el existente está en la lista para ofrecer editarlo.
 */
export function useCrearExamen() {
  const refrescar = useRefrescarPorExamen()
  const invalidarExamenes = useInvalidarExamenes()

  return useMutation<ExamenDetalle, ApiError, ExamenCrear>({
    mutationFn: crearExamen,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 409) void invalidarExamenes()
    },
  })
}
