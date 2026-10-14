import { useMutation } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarCuentas } from '@/features/cuentas/hooks/use-invalidar-cuentas'
import { useInvalidarHistoriales } from '@/features/historiales/hooks/use-invalidar-historiales'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import { registrarAsistencias } from '../api/asistencias.api'
import type { AsistenciasRegistradas, RegistrarAsistencias } from '../asistencias.types'
import { useInvalidarAsistencias } from './use-invalidar-asistencias'

/**
 * Registra o corrige asistencias (`PUT /asistencias`). Al terminar bien invalida lo que muestra el
 * estado de esas ocurrencias: asistencias, ocurrencias, agendas, historiales y cuentas. Un 409
 * (`FUERA_DE_PLAZO`, `TURNO_CANCELADO`) dice que la pantalla tenía datos viejos: vuelve a pedirla.
 */
export function useRegistrarAsistencias() {
  const invalidarAsistencias = useInvalidarAsistencias()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()
  const invalidarHistoriales = useInvalidarHistoriales()
  const invalidarCuentas = useInvalidarCuentas()

  return useMutation<AsistenciasRegistradas, ApiError, RegistrarAsistencias>({
    mutationFn: registrarAsistencias,
    onSuccess: () => {
      void invalidarAsistencias()
      void invalidarOcurrencias()
      void invalidarAgendas()
      void invalidarHistoriales()
      void invalidarCuentas()
    },
    onError: (error) => {
      if (error.status === 409) void invalidarAsistencias()
    },
  })
}
