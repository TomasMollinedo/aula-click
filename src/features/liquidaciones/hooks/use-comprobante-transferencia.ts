import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerComprobanteTransferencia } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { AdjuntoDeLiquidacion } from '../liquidaciones.types'

/** Menos que los 15 minutos de la URL prefirmada: se renueva antes de que venza. */
const RENOVAR_URL_MS = 10 * 60 * 1000

/**
 * El comprobante de la transferencia con la URL para abrirlo
 * (`GET /adjuntos/liquidaciones/{liquidacionId}`), como `useAdjuntoDePago` de `pagos` (una feature
 * no importa de otra). Se pide solo si el detalle dice que tiene uno (`habilitado`); la URL se
 * renueva cada 10 minutos y al salir se descarta (`gcTime: 0`), así nunca se ofrece una vencida
 * ni queda guardada.
 */
export function useComprobanteTransferencia(liquidacionId: number, habilitado: boolean) {
  return useQuery<AdjuntoDeLiquidacion, ApiError>({
    queryKey: liquidacionesKeys.comprobante(liquidacionId),
    queryFn: () => obtenerComprobanteTransferencia(liquidacionId),
    enabled: habilitado,
    staleTime: RENOVAR_URL_MS,
    refetchInterval: RENOVAR_URL_MS,
    gcTime: 0,
  })
}
