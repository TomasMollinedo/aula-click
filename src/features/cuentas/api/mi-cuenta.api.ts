import { fetchJson } from '@/utils/fetch-json'

import type { MiCuenta } from '../cuentas.types'

/**
 * La cuenta del alumno de la sesión (portal, HU-37): `GET /cuentas/mi-cuenta`. El alumno sale de la
 * sesión, nunca de un parámetro.
 */
export function obtenerMiCuenta(): Promise<MiCuenta> {
  return fetchJson<MiCuenta>('/api/v1/cuentas/mi-cuenta')
}
