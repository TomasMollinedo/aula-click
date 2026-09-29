import type { DisponibilidadParams } from '../turnos.types'

// Todo cuelga de `all`: el alta invalida `all`. Las agendas tienen sus propias keys
// (`features/agendas`) y se refrescan con `useInvalidarAgendas`.
export const turnosKeys = {
  all: ['turnos'] as const,
  disponibilidades: () => [...turnosKeys.all, 'disponibilidad'] as const,
  disponibilidad: (params: DisponibilidadParams) =>
    [...turnosKeys.disponibilidades(), params] as const,
}
