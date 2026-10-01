import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import { reprogramarTurno } from '../api/reprogramaciones.api'
import { turnosKeys } from '../api/turnos.keys'
import type { ReprogramacionCreada, ReprogramarTurnoBody } from '../reprogramacion.types'

/**
 * Reprograma una ocurrencia (todo o nada). Al terminar invalida lo que cambia: la disponibilidad
 * (la hora de origen quedó libre y la de destino se ocupó), las ocurrencias (el detalle y la lista
 * del alumno) y las agendas. Un 409 también refresca: el rechazo puede venir de datos viejos (otro
 * ocupó el último lugar), y la búsqueda tiene que mostrar lo actual.
 */
export function useReprogramarTurno() {
  const queryClient = useQueryClient()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: turnosKeys.disponibilidades() })
    void invalidarOcurrencias()
    void invalidarAgendas()
  }

  return useMutation<ReprogramacionCreada, ApiError, ReprogramarTurnoBody>({
    mutationFn: reprogramarTurno,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 409) refrescar()
    },
  })
}
