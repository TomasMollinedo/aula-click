// Todo cuelga de `all`: una mutación de otra feature que cambia lo que muestra el historial
// académico (turnos, asistencias, exámenes) lo invalida con `useInvalidarHistoriales`.
export const historialesKeys = {
  all: ['historiales'] as const,
}
