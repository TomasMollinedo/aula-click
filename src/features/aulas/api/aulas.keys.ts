import type { AulasDisponiblesParams } from '../aulas.types'

export const aulasKeys = {
  all: ['aulas'] as const,
  /** Parcial mientras el formulario no completó el horario (la query queda deshabilitada). */
  disponibles: (params: Partial<AulasDisponiblesParams>) =>
    [...aulasKeys.all, 'disponibles', params] as const,
}
