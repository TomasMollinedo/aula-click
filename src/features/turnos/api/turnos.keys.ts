import type { DisponibilidadParams } from '../turnos.types'

// Todo cuelga de `all`: el alta invalida `all` y así alcanza también a lo que sume la agenda (T-24).
export const turnosKeys = {
  all: ['turnos'] as const,
  disponibilidades: () => [...turnosKeys.all, 'disponibilidad'] as const,
  disponibilidad: (params: DisponibilidadParams) =>
    [...turnosKeys.disponibilidades(), params] as const,
  details: () => [...turnosKeys.all, 'detail'] as const,
  detail: (id: number) => [...turnosKeys.details(), id] as const,
}
