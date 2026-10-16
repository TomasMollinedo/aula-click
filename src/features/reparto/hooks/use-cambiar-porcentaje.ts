import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { cambiarPorcentaje } from '../api/reparto.api'
import { repartoKeys } from '../api/reparto.keys'
import type { PorcentajeVigente } from '../reparto.types'

/** Registra un porcentaje del centro nuevo e invalida el vigente y el historial. */
export function useCambiarPorcentaje() {
  const queryClient = useQueryClient()

  return useMutation<PorcentajeVigente, ApiError, number>({
    mutationFn: cambiarPorcentaje,
    onSuccess: () => {
      // Solo lo de reparto: cada cobro guarda su porcentaje, así que cobros, liquidaciones, caja y tablero no cambian.
      void queryClient.invalidateQueries({ queryKey: repartoKeys.all })
    },
  })
}
