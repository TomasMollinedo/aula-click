import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { Comprobante } from '../pagos.types'
import { obtenerComprobante } from '../api/pagos.api'
import { pagosKeys } from '../api/pagos.keys'

/** Datos del comprobante de un pago (`GET /pagos/{id}`). Deshabilitado sin un id válido. */
export function useComprobante(pagoId: number) {
  return useQuery<Comprobante, ApiError>({
    queryKey: pagosKeys.comprobante(pagoId),
    queryFn: () => obtenerComprobante(pagoId),
    enabled: Number.isInteger(pagoId) && pagoId > 0,
  })
}
