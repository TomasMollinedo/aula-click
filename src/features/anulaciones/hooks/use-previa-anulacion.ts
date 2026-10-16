import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerPrevia } from '../api/anulaciones.api'
import { anulacionesKeys } from '../api/anulaciones.keys'
import type { PreviaAnulacion } from '../anulaciones.types'

/**
 * El resumen y los avisos de anular el pago (`GET /anulaciones/previa`). Los avisos dependen de la
 * deuda y de los precios de hoy: no se guardan en la cache (`gcTime: 0`), así cada vez que se abre
 * el diálogo se piden de nuevo. Un 4xx (no existe, ya anulado) no cambia reintentando.
 */
export function usePreviaAnulacion(pagoId: number) {
  return useQuery<PreviaAnulacion, ApiError>({
    queryKey: anulacionesKeys.previa(pagoId),
    queryFn: () => obtenerPrevia(pagoId),
    gcTime: 0,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
