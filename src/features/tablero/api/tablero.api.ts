import { fetchJson } from '@/utils/fetch-json'

import type { ParamsAsistencia, PeriodoTablero, Tablero, TableroAsistencia } from '../tablero.types'

const BASE = '/api/v1/tablero'

export function obtenerTablero({ desde, hasta }: PeriodoTablero): Promise<Tablero> {
  const params = new URLSearchParams({ desde, hasta })
  return fetchJson<Tablero>(`${BASE}?${params.toString()}`)
}

/**
 * La sección "Asistencia" (HU-39): el resumen del período y las dos tablas, cada una en su página.
 * Se mandan todos los parámetros, también los que coinciden con el valor por defecto de la API: la
 * URL de la pantalla es la que decide qué no escribir.
 */
export function obtenerTableroAsistencia({
  desde,
  hasta,
  paginaProfesores,
  paginaMaterias,
  orden,
  direccion,
  soloSinRegistrar,
}: ParamsAsistencia): Promise<TableroAsistencia> {
  const params = new URLSearchParams({
    desde,
    hasta,
    paginaProfesores: String(paginaProfesores),
    paginaMaterias: String(paginaMaterias),
    orden,
    direccion,
    soloSinRegistrar: String(soloSinRegistrar),
  })
  return fetchJson<TableroAsistencia>(`${BASE}/asistencia?${params.toString()}`)
}
