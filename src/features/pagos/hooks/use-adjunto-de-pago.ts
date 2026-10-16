import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerAdjuntoDePago } from '../api/adjuntos.api'
import { pagosKeys } from '../api/pagos.keys'
import type { AdjuntoConUrl } from '../pago-detalle.types'

/** Menos que los 15 minutos de la URL prefirmada: se renueva antes de que venza. */
const RENOVAR_URL_MS = 10 * 60 * 1000

/**
 * El comprobante adjunto con la URL para abrirlo (`GET /adjuntos/pagos/{pagoId}`). Se pide solo si
 * el detalle dice que tiene uno (`habilitado`). La URL vence a los 15 minutos: se renueva cada 10
 * mientras el detalle está abierto, y al cerrarlo se descarta (`gcTime: 0`), así nunca se ofrece
 * una vencida ni queda guardada.
 */
export function useAdjuntoDePago(pagoId: number, habilitado: boolean) {
  return useQuery<AdjuntoConUrl, ApiError>({
    queryKey: pagosKeys.adjunto(pagoId),
    queryFn: () => obtenerAdjuntoDePago(pagoId),
    enabled: habilitado,
    staleTime: RENOVAR_URL_MS,
    refetchInterval: RENOVAR_URL_MS,
    gcTime: 0,
  })
}
