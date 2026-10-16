import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { registrarPagoLiquidacion } from '../api/liquidaciones.api'
import { liquidacionesKeys } from '../api/liquidaciones.keys'
import type { PagoLiquidacionRegistrado, RegistrarPagoLiquidacion } from '../liquidaciones.types'

type Variables = { profesorId: number; mes: string; body: RegistrarPagoLiquidacion }

/**
 * Registrar el pago de una liquidación (HU-44, T-132). Al terminar bien invalida
 * `liquidacionesKeys.all` (listado, detalle, "Mis ingresos" y comprobante). Con cualquier 409
 * invalida lo mismo: lo que tenía quien abrió el diálogo quedó viejo. No muestra toasts: eso lo
 * decide el diálogo.
 */
export function useRegistrarPagoLiquidacion() {
  const queryClient = useQueryClient()
  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: liquidacionesKeys.all })
  }

  return useMutation<PagoLiquidacionRegistrado, ApiError, Variables>({
    mutationFn: registrarPagoLiquidacion,
    onSuccess: invalidar,
    onError: (error) => {
      if (error.status === 409) invalidar()
    },
  })
}
