import type { ObtenerOcurrenciaParams, OcurrenciasDelAlumnoParams } from '../ocurrencias.types'

// Todo cuelga de `all`: una mutación de otra feature (cancelación, finalización, reprogramación,
// pago, asistencia) invalida `all` con `useInvalidarOcurrencias` y alcanza al detalle, a los turnos
// del alumno y al detalle del portal (`miTurno`).
export const ocurrenciasKeys = {
  all: ['ocurrencias'] as const,
  detalles: () => [...ocurrenciasKeys.all, 'detalle'] as const,
  detalle: (params: ObtenerOcurrenciaParams) => [...ocurrenciasKeys.detalles(), params] as const,
  delAlumnos: () => [...ocurrenciasKeys.all, 'delAlumno'] as const,
  delAlumno: (params: OcurrenciasDelAlumnoParams) =>
    [...ocurrenciasKeys.delAlumnos(), params] as const,
  miTurnoDetalles: () => [...ocurrenciasKeys.all, 'miTurno'] as const,
  miTurno: (params: ObtenerOcurrenciaParams) =>
    [...ocurrenciasKeys.miTurnoDetalles(), params] as const,
}
