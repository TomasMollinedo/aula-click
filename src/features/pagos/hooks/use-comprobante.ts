import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Comprobante } from '../pagos.types'
import { obtenerComprobante } from '../api/pagos.api'
import { pagosKeys } from '../api/pagos.keys'

/**
 * Datos del comprobante de un pago (`GET /pagos/{id}`). Deshabilitado sin un id válido; un 404 o un
 * 403 no se reintentan.
 */
export function useComprobante(pagoId: number) {
  return useQuery<Comprobante, ApiError>({
    queryKey: pagosKeys.comprobante(pagoId),
    queryFn: () => obtenerComprobante(pagoId),
    enabled: Number.isInteger(pagoId) && pagoId > 0,
    // Un 4xx (404: el pago no existe; 403: sin permiso) no cambia por reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
