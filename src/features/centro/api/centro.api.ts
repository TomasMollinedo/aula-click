import { fetchJson } from '@/utils/fetch-json'

import type { Centro } from '../centro.types'

const BASE = '/api/v1/centro'

/** Nombre, dirección y teléfono del centro (precargados, sin pantalla para editarlos: HU-11). */
export function obtenerCentro(): Promise<Centro> {
  return fetchJson<Centro>(BASE)
}
