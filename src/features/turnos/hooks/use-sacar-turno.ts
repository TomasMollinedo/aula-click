import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import type { MiTurnoCrear, MiTurnoReservado } from '../mis-turnos.types'
import { sacarTurno } from '../api/mis-turnos.api'
import { misTurnosKeys } from '../api/mis-turnos.keys'

/**
 * Saca un turno desde el portal. Al terminar bien invalida lo del portal (la disponibilidad y la
 * habilitación) y las agendas y las ocurrencias ("Mi calendario" y el detalle tienen turnos
 * nuevos). Un 409 `DEUDA_VENCIDA` también invalida la habilitación: la deuda cambió desde que se
 * entró a la pantalla.
 */
export function useSacarTurno() {
  const queryClient = useQueryClient()
  const invalidarAgendas = useInvalidarAgendas()
  const invalidarOcurrencias = useInvalidarOcurrencias()

  return useMutation<MiTurnoReservado, ApiError, MiTurnoCrear>({
    mutationFn: sacarTurno,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: misTurnosKeys.all })
      void invalidarAgendas()
      void invalidarOcurrencias()
    },
    onError: (error) => {
      if (error.code === 'DEUDA_VENCIDA') {
        void queryClient.invalidateQueries({ queryKey: misTurnosKeys.habilitacion() })
      }
    },
  })
}
