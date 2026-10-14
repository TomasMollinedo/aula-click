// Todo cuelga de `all`: una mutación de otra feature que cambia la asistencia de un turno la
// invalida con `useInvalidarAsistencias`.
export const asistenciasKeys = {
  all: ['asistencias'] as const,
  dias: () => [...asistenciasKeys.all, 'dia'] as const,
  dia: (fecha: string) => [...asistenciasKeys.dias(), fecha] as const,
  pendientes: () => [...asistenciasKeys.all, 'pendientes'] as const,
}
