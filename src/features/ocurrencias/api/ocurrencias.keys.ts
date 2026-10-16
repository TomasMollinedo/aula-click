import type {
  MisTurnosParams,
  ObtenerOcurrenciaParams,
  OcurrenciasDelAlumnoParams,
} from '../ocurrencias.types'

// Todo cuelga de `all`: una mutación de otra feature (cancelación, finalización, reprogramación,
// pago, asistencia) invalida `all` con `useInvalidarOcurrencias` y alcanza al detalle, a los turnos
// del alumno, a "Mi calendario" (`misTurnos`) y al detalle del portal (`miTurno`).
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
  misTurnosListas: () => [...ocurrenciasKeys.all, 'misTurnos'] as const,
  misTurnos: (params: MisTurnosParams) => [...ocurrenciasKeys.misTurnosListas(), params] as const,
}
