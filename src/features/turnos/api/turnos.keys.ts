import type { AgendaListadoParams } from '../turnos.types'

export const turnosKeys = {
  all: ['turnos'] as const,
  agendas: () => [...turnosKeys.all, 'agenda'] as const,
  agenda: (params: AgendaListadoParams) => [...turnosKeys.agendas(), params] as const,
}
