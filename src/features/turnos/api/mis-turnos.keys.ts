import type { MiDisponibilidadParams } from '../mis-turnos.types'

// Keys propias del portal, separadas de las de la mesa (`turnos.keys.ts`): son otros endpoints y
// otra sesión. Todo cuelga de `all`: sacar un turno invalida `all` (la disponibilidad y la
// habilitación cambian). Las agendas y las ocurrencias se refrescan con los hooks de sus features.
export const misTurnosKeys = {
  all: ['mis-turnos'] as const,
  habilitacion: () => [...misTurnosKeys.all, 'habilitacion'] as const,
  materias: () => [...misTurnosKeys.all, 'materias'] as const,
  disponibilidades: () => [...misTurnosKeys.all, 'disponibilidad'] as const,
  disponibilidad: (params: MiDisponibilidadParams) =>
    [...misTurnosKeys.disponibilidades(), params] as const,
}
