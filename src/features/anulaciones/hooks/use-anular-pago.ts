import { useMutation } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarCuentas } from '@/features/cuentas/hooks/use-invalidar-cuentas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import { useInvalidarPagos } from '@/features/pagos/hooks/use-invalidar-pagos'
import type { ApiError } from '@/utils/fetch-json'

import { anularPago } from '../api/anulaciones.api'
import type { AnulacionCreada, AnularPagoBody } from '../anulaciones.types'

/**
 * Anula un pago (HU-42). Al anular invalida lo que cambia: el pago (que pasa a "Anulado"), las
 * cuentas y las ocurrencias (sus turnos vuelven a estar por cobrar) y las agendas. Con un 409 invalida
 * lo mismo: si otra persona ya lo anuló, lo que muestra la pantalla quedó viejo. No invalida la
 * previa: es de un pago que ya no se puede anular y se pide de nuevo al abrir el diálogo.
 */
export function useAnularPago() {
  const invalidarPagos = useInvalidarPagos()
  const invalidarCuentas = useInvalidarCuentas()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()

  const refrescar = () => {
    void invalidarPagos()
    void invalidarCuentas()
    void invalidarOcurrencias()
    void invalidarAgendas()
  }

  return useMutation<AnulacionCreada, ApiError, AnularPagoBody>({
    mutationFn: anularPago,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status === 409) refrescar()
    },
  })
}
