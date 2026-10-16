import { fetchJson } from '@/utils/fetch-json'

import type { Caja, ListarCajaParams } from '../caja.types'

const BASE = '/api/v1/caja'

/**
 * La caja de un día (`GET /caja`). Sin `fecha`, la API devuelve la de hoy en la zona del negocio y
 * la rotula en `fecha`. `tipo` y `formaPago` recortan sólo los movimientos: el resumen es siempre
 * el del día completo.
 */
export function obtenerCaja({ fecha, tipo, formaPago }: ListarCajaParams): Promise<Caja> {
  const params = new URLSearchParams()
  if (fecha !== undefined) params.set('fecha', fecha)
  if (tipo !== undefined) params.set('tipo', tipo)
  if (formaPago !== undefined) params.set('formaPago', formaPago)
  const query = params.toString()
  return fetchJson<Caja>(query ? `${BASE}?${query}` : BASE)
}
