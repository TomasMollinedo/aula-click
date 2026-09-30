import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { CuentaDelAlumno } from '../cuentas.types'
import { obtenerCuentaDelAlumno } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/** Deuda, próximos turnos e historial de pagos de un alumno (pestaña "Pagos" de la ficha). */
export function useCuentaDelAlumno(alumnoId: number) {
  return useQuery<CuentaDelAlumno, ApiError>({
    queryKey: cuentasKeys.alumno(alumnoId),
    queryFn: () => obtenerCuentaDelAlumno(alumnoId),
    enabled: alumnoId > 0,
  })
}
