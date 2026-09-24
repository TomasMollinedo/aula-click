import { fetchJson } from '@/utils/fetch-json'

import type { MateriaSelectorItem } from '../materias.types'

const BASE = '/api/v1/materias'

/** Materias activas ordenadas por nombre, sin paginar (docs/contrato-api.md → Selectores de catálogo). */
export function listarSelectorMaterias(): Promise<MateriaSelectorItem[]> {
  return fetchJson<MateriaSelectorItem[]>(`${BASE}/selector`)
}
