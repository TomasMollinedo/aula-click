import type { PaginatedResponse } from '@/types'
import { fetchJson } from '@/utils/fetch-json'

import type { MiPago } from '../pagos.types'

/**
 * Los pagos del alumno de la sesión, del más reciente al más antiguo, paginados (portal, HU-37):
 * `GET /pagos/mis-pagos`. El alumno sale de la sesión, nunca de un parámetro.
 */
export function listarMisPagos(page: number): Promise<PaginatedResponse<MiPago>> {
  return fetchJson<PaginatedResponse<MiPago>>(`/api/v1/pagos/mis-pagos?page=${page}`)
}
