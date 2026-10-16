import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerPago } from '../api/pagos.api'
import { pagosKeys } from '../api/pagos.keys'
import type { DetallePago } from '../pago-detalle.types'

/**
 * El detalle de un pago (`?pago=<pagoId>`). Su key cuelga de `pagosKeys.all`: anular un pago (que
 * invalida `all`) lo vuelve a pedir y se ve "Anulado".
 */
export function usePago(pagoId: number) {
  return useQuery<DetallePago, ApiError>({
    queryKey: pagosKeys.detalle(pagoId),
    queryFn: () => obtenerPago(pagoId),
  })
}
