import type { ObtenerOcurrenciaParams, OcurrenciasDelAlumnoParams } from '../ocurrencias.types'

// Todo cuelga de `all`: una mutación de otra feature (cancelación, finalización, reprogramación,
// pago) invalida `all` con `useInvalidarOcurrencias` y alcanza al detalle y a los turnos del alumno.
export const ocurrenciasKeys = {
  all: ['ocurrencias'] as const,
  detalles: () => [...ocurrenciasKeys.all, 'detalle'] as const,
  detalle: (params: ObtenerOcurrenciaParams) => [...ocurrenciasKeys.detalles(), params] as const,
  delAlumnos: () => [...ocurrenciasKeys.all, 'delAlumno'] as const,
  delAlumno: (params: OcurrenciasDelAlumnoParams) =>
    [...ocurrenciasKeys.delAlumnos(), params] as const,
}
