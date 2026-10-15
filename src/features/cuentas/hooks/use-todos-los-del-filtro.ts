import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { FiltrosCuentaParams, OcurrenciaDeCuenta } from '../cuentas.types'
import { obtenerCuentaDelAlumno } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Todos los turnos de un alumno con sus filtros, adeudados y próximos, a pedido: para "Seleccionar
 * todo" de la vista global (HU-25), donde cada tabla solo tiene una página. Salen de la cuenta del
 * alumno (`GET /cuentas/alumnos/{alumnoId}`), que los trae sin paginar, con los mismos filtros (también
 * varias materias) y los próximos hasta el tope de cobro, y quedan en la misma cache que usa la
 * ficha (se invalida con el resto de `cuentas`). Una sección que no aplica al período no suma nada.
 */
export function useTodosLosDelFiltro() {
  const queryClient = useQueryClient()
  const [cargando, setCargando] = useState(false)

  const traer = useCallback(
    async (alumnoId: number, filtros: FiltrosCuentaParams): Promise<OcurrenciaDeCuenta[]> => {
      setCargando(true)
      try {
        const cuenta = await queryClient.fetchQuery({
          queryKey: cuentasKeys.alumno(alumnoId, filtros),
          queryFn: () => obtenerCuentaDelAlumno(alumnoId, filtros),
        })
        return [...(cuenta.adeudados ?? []), ...(cuenta.proximos ?? [])]
      } finally {
        setCargando(false)
      }
    },
    [queryClient],
  )

  return { traer, cargando }
}
