import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMiCuenta } from '../api/mi-cuenta.api'
import { cuentasKeys } from '../api/cuentas.keys'
import type { MiCuenta } from '../cuentas.types'

/** Lo que el alumno de la sesión tiene pendiente de pago, en "Mis pagos" del portal (HU-37). */
export function useMiCuenta() {
  return useQuery<MiCuenta, ApiError>({
    queryKey: cuentasKeys.miCuenta(),
    queryFn: obtenerMiCuenta,
  })
}
