import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { OpcionesDeCuenta } from '../cuentas.types'
import { obtenerOpcionesDeCuenta } from '../api/cuentas.api'
import { cuentasKeys } from '../api/cuentas.keys'

/**
 * Las materias y los profesores de lo que el alumno tiene por cobrar (decisión T-177), para los
 * filtros de "Por cobrar" con un alumno: el de la ficha o el elegido en la vista global. Sin alumno
 * no se pide (`alumnoId: null`). Los dos filtros lo usan con la misma clave: es un solo pedido.
 */
export function useOpcionesDeCuenta(alumnoId: number | null) {
  return useQuery<OpcionesDeCuenta, ApiError>({
    queryKey: cuentasKeys.opciones(alumnoId ?? 0),
    queryFn: () => obtenerOpcionesDeCuenta(alumnoId ?? 0),
    enabled: alumnoId !== null && alumnoId > 0,
    // Un 4xx (alumno inexistente, sin permiso) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
