import { fetchJson } from '@/utils/fetch-json'

import type { AulaDisponible, AulasDisponiblesParams } from '../aulas.types'

const BASE = '/api/v1/aulas'

/**
 * Aulas activas libres durante todo el horario pedido, ordenadas por nombre, sin paginar
 * (docs/contrato-api.md → Selectores con filtros). `[]` si no hay ninguna: no es un error.
 */
export function listarAulasDisponibles(params: AulasDisponiblesParams): Promise<AulaDisponible[]> {
  const searchParams = new URLSearchParams({
    diaSemana: String(params.diaSemana),
    horaInicio: params.horaInicio,
    horaFin: params.horaFin,
  })
  if (params.excluirBloqueId != null) {
    searchParams.set('excluirBloqueId', String(params.excluirBloqueId))
  }
  return fetchJson<AulaDisponible[]>(`${BASE}/disponibles?${searchParams}`)
}
