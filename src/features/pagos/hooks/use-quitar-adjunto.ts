import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { quitarAdjuntoDePago } from '../api/adjuntos.api'
import { pagosKeys } from '../api/pagos.keys'

/**
 * Quita el comprobante adjunto de un pago con débito (HU-24, baja lógica: el archivo queda
 * guardado). Al terminar invalida el detalle del pago, que se ve sin comprobante adjunto. Con un
 * 404 o un 409 (`ADJUNTO_OBLIGATORIO`, `PAGO_ANULADO`) también: lo que mostraba quedó viejo. Solo
 * el detalle (`exact`): el adjunto ya no está y pedirlo daría 404; cuando el detalle releído trae
 * `adjunto: null`, su query se apaga sola. No muestra toasts: eso lo decide el diálogo.
 */
export function useQuitarAdjunto(pagoId: number) {
  const queryClient = useQueryClient()
  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: pagosKeys.detalle(pagoId), exact: true })

  return useMutation<void, ApiError, void>({
    mutationFn: () => quitarAdjuntoDePago(pagoId),
    onSuccess: () => invalidar(),
    onError: (error) => {
      if (error.status === 404 || error.status === 409) void invalidar()
    },
  })
}
