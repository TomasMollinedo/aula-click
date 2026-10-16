import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { reemplazarAdjuntoDePago } from '../api/adjuntos.api'
import { pagosKeys } from '../api/pagos.keys'
import type { AdjuntoConUrl } from '../pago-detalle.types'

/**
 * Reemplaza el comprobante adjunto de un pago o, en un débito sin adjunto, lo adjunta (HU-24). Al
 * terminar invalida el detalle del pago (y con él su adjunto), que muestra el nuevo con quién y
 * cuándo. Con un 404 o un 409 (pago anulado, en efectivo) también: lo que mostraba quedó viejo. No
 * muestra toasts: eso lo decide el diálogo.
 */
export function useReemplazarAdjunto(pagoId: number) {
  const queryClient = useQueryClient()
  const invalidar = () => queryClient.invalidateQueries({ queryKey: pagosKeys.detalle(pagoId) })

  return useMutation<AdjuntoConUrl, ApiError, File>({
    mutationFn: (archivo) => reemplazarAdjuntoDePago(pagoId, archivo),
    onSuccess: () => invalidar(),
    onError: (error) => {
      if (error.status === 404 || error.status === 409) void invalidar()
    },
  })
}
