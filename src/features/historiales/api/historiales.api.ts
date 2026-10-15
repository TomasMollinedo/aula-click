import { fetchJson } from '@/utils/fetch-json'

import type { HistorialDelAlumno, HistorialParams } from '../historiales.types'

const BASE = '/api/v1/historiales'

/**
 * El historial académico de un alumno en un período (HU-31). `desde` y `hasta` van siempre (el mes
 * en curso es el que propone la pantalla, no la ausencia del parámetro) y los filtros vacíos no se
 * mandan. El período no se valida acá: un `hasta` anterior al `desde` vuelve como 400 con `details`
 * sobre `hasta`.
 */
export function obtenerHistorialDelAlumno(
  alumnoId: number,
  { desde, hasta, materiaId, profesorId }: HistorialParams,
): Promise<HistorialDelAlumno> {
  const params = new URLSearchParams({ desde, hasta })
  if (materiaId !== undefined) params.set('materiaId', String(materiaId))
  if (profesorId !== undefined) params.set('profesorId', String(profesorId))
  return fetchJson<HistorialDelAlumno>(`${BASE}/alumnos/${alumnoId}?${params.toString()}`)
}
