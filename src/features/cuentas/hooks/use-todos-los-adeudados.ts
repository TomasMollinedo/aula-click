import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { FiltrosCuentaParams, OcurrenciaDeCuenta } from '../cuentas.types'
import { obtenerCuentaDelAlumno } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Todos los adeudados de un alumno con sus filtros, a pedido: para "Seleccionar todos los
 * adeudados" de la vista global, donde la tabla solo tiene una página. Salen de la cuenta del
 * alumno (`GET /cuentas/alumnos/{alumnoId}`), que los trae sin paginar y con los mismos filtros, y
 * quedan en la misma cache que usa la ficha (se invalida con el resto de `cuentas`). Si la sección
 * no aplica al período, `[]`.
 */
export function useTodosLosAdeudados() {
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
        return cuenta.adeudados ?? []
      } finally {
        setCargando(false)
      }
    },
    [queryClient],
  )

  return { traer, cargando }
}
