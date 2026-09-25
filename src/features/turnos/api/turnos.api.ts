import { fetchJson } from '@/utils/fetch-json'

import type { AgendaListadoParams, AgendaListadoResponse } from '../turnos.types'

const BASE = '/api/v1/turnos'

export function listarAgenda(params: AgendaListadoParams): Promise<AgendaListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.fecha) searchParams.set('fecha', params.fecha)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.profesorId != null) searchParams.set('profesorId', String(params.profesorId))

  const qs = searchParams.toString()
  return fetchJson<AgendaListadoResponse>(qs ? `${BASE}/agenda?${qs}` : `${BASE}/agenda`)
}
