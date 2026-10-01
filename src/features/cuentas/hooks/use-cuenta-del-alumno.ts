import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { CuentaDelAlumno, FiltrosCuentaParams } from '../cuentas.types'
import { obtenerCuentaDelAlumno } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Adeudados y próximos turnos de un alumno, con sus filtros (pestaña "Pagos" de la ficha).
 *
 * Al cambiar un filtro conserva la cuenta anterior mientras llega la nueva (`isPlaceholderData`),
 * para que la pantalla no vuelva al esqueleto, pero **solo si es del mismo alumno**: nunca se
 * muestra la cuenta de otro mientras carga. Con datos de placeholder la pantalla no deja tildar ni
 * cobrar.
 */
export function useCuentaDelAlumno(alumnoId: number, filtros: FiltrosCuentaParams = {}) {
  return useQuery<CuentaDelAlumno, ApiError>({
    queryKey: cuentasKeys.alumno(alumnoId, filtros),
    queryFn: () => obtenerCuentaDelAlumno(alumnoId, filtros),
    enabled: alumnoId > 0,
    placeholderData: (anterior, queryAnterior) =>
      queryAnterior?.queryKey[2] === alumnoId ? anterior : undefined,
    // Un 4xx (alumno inexistente, período inválido, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
