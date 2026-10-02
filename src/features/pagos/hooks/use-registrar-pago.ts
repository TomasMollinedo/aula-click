import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarCuentas } from '@/features/cuentas/hooks/use-invalidar-cuentas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import type { PagoRegistrado, RegistrarPago } from '../pagos.types'
import { registrarPago } from '../api/pagos.api'
import { pagosKeys } from '../api/pagos.keys'
import { CODIGO_TURNOS_NO_COBRABLES } from '../errores-pagos'

/**
 * Registrar un pago (HU-15). Al terminar bien invalida lo de pagos y, con sus hooks, las
 * ocurrencias, las cuentas y las agendas, que muestran el estado de pago. Con el 409
 * `TURNOS_NO_COBRABLES` invalida lo mismo: lo que tenía quien abrió el diálogo quedó viejo (otro
 * usuario cobró o canceló alguna). No muestra toasts: eso lo decide el diálogo.
 */
export function useRegistrarPago() {
  const queryClient = useQueryClient()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarCuentas = useInvalidarCuentas()
  const invalidarAgendas = useInvalidarAgendas()

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: pagosKeys.all })
    void invalidarOcurrencias()
    void invalidarCuentas()
    void invalidarAgendas()
  }

  return useMutation<PagoRegistrado, ApiError, RegistrarPago>({
    mutationFn: registrarPago,
    onSuccess: invalidar,
    onError: (error) => {
      if (error.status === 409 && error.code === CODIGO_TURNOS_NO_COBRABLES) invalidar()
    },
  })
}
