import { useMutation } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { subirAdjunto } from '../api/adjuntos.api'
import type { AdjuntoSubido } from '../pagos.types'

/**
 * Sube el comprobante que se elige al registrar un pago (HU-24, T-97), antes de registrarlo: el
 * `id` de la respuesta es el `comprobanteAdjuntoId` del pago. No invalida nada (el adjunto no tiene
 * pago todavía) ni muestra toasts: el error se ve en el campo "Comprobante" (`errorDeAdjunto`).
 */
export function useSubirAdjunto() {
  return useMutation<AdjuntoSubido, ApiError, File>({ mutationFn: subirAdjunto })
}
