import { useMutation } from '@tanstack/react-query'

import { useInvalidarAgendas } from '@/features/agendas/hooks/use-invalidar-agendas'
import { useInvalidarCuentas } from '@/features/cuentas/hooks/use-invalidar-cuentas'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { ApiError } from '@/utils/fetch-json'

import { finalizarTurno } from '../api/finalizaciones.api'
import type { FinalizacionCreada, FinalizarTurnoBody } from '../finalizaciones.types'
import { useInvalidarFinalizaciones } from './use-invalidar-finalizaciones'

/**
 * Finaliza un turno recurrente desde una fecha. Al finalizar invalida lo que cambia: las agendas
 * (el lugar quedó libre), las cuentas (la deuda del alumno baja) y las previas. Un 409 refresca
 * todo, también las ocurrencias: si no se pudo finalizar, es porque la pantalla tenía datos viejos
 * (entró un pago, otro ya lo finalizó).
 *
 * **En el éxito, las ocurrencias las invalida `AccionFinalizarTurno`**, no este hook: si la
 * ocurrencia que muestra el detalle dejó de existir, primero hay que llevar el detalle a una que
 * exista; refrescarlo antes mostraría "Turno no encontrado" por un instante.
 */
export function useFinalizarTurno() {
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const invalidarAgendas = useInvalidarAgendas()
  const invalidarCuentas = useInvalidarCuentas()
  const invalidarFinalizaciones = useInvalidarFinalizaciones()

  const refrescar = () => {
    void invalidarAgendas()
    void invalidarCuentas()
    void invalidarFinalizaciones()
  }

  return useMutation<FinalizacionCreada, ApiError, FinalizarTurnoBody>({
    mutationFn: finalizarTurno,
    onSuccess: refrescar,
    onError: (error) => {
      if (error.status !== 409) return
      refrescar()
      void invalidarOcurrencias()
    },
  })
}
