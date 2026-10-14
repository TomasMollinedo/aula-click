import { fetchJson } from '@/utils/fetch-json'

import type {
  AsistenciasDelDia,
  AsistenciasPendientes,
  AsistenciasRegistradas,
  RegistrarAsistencias,
} from '../asistencias.types'

const BASE = '/api/v1/asistencias'

/** Las clases del profesor de la sesión en `fecha` (hoy o anterior), con sus filas. */
export function obtenerAsistenciasDelDia(fecha: string): Promise<AsistenciasDelDia> {
  return fetchJson<AsistenciasDelDia>(`${BASE}?fecha=${fecha}`)
}

/** Turnos de días anteriores sin registrar y todavía en plazo. */
export function obtenerPendientes(): Promise<AsistenciasPendientes> {
  return fetchJson<AsistenciasPendientes>(`${BASE}/pendientes`)
}

/** Registra o corrige, todo o nada. */
export function registrarAsistencias(datos: RegistrarAsistencias): Promise<AsistenciasRegistradas> {
  return fetchJson<AsistenciasRegistradas>(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
