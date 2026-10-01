import { useMutation } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarCuentas } from '@/features/cuentas/hooks/use-invalidar-cuentas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import { cancelarTurnos } from '../api/cancelaciones.api'
import type { CancelacionesCreadas, CancelarTurnosBody } from '../cancelaciones.types'

/**
 * Cancela una o varias ocurrencias (todo o nada). Al cancelar invalida lo que cambia: las
 * ocurrencias (detalle y lista del alumno), las agendas (el lugar quedó libre) y las cuentas (la
 * deuda del alumno baja). Un 409 también refresca: si algo no se pudo cancelar, es porque la
 * pantalla tenía datos viejos (otro lo pagó, ya estaba cancelado).
 */
export function useCancelarTurnos() {
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()
  const invalidarCuentas = useInvalidarCuentas()

  const refrescar = () => {
    void invalidarOcurrencias()
    void invalidarAgendas()
    void invalidarCuentas()
  }

  return useMutation<CancelacionesCreadas, ApiError, CancelarTurnosBody>({
    mutationFn: cancelarTurnos,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 409) refrescar()
    },
  })
}
