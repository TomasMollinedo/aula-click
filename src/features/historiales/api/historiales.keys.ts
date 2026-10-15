import type { HistorialParams } from '../historiales.types'

// Todo cuelga de `all`: una mutación de otra feature que cambia lo que muestra el historial
// académico (turnos, asistencias, exámenes) lo invalida con `useInvalidarHistoriales`.
export const historialesKeys = {
  all: ['historiales'] as const,
  /** El historial de un alumno en un período con sus filtros (HU-31). */
  delAlumno: (alumnoId: number, params: HistorialParams) =>
    [...historialesKeys.all, 'alumno', alumnoId, params] as const,
}
