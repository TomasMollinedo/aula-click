import { fetchJson } from '@/utils/fetch-json'

import type { AlumnoDetalle } from '../alumnos.types'
import { alumnosKeys } from './alumnos.keys'

// Acceso al portal del alumno (HU-27, docs/contrato-api.md → Alumnos → Acceso al portal).

const BASE = '/api/v1/alumnos'

/** Datos con los que se sugiere el usuario. */
export type DatosUsuarioSugerido = { nombre: string; apellido: string; dni: string }

/** Query key del usuario sugerido: cuelga de `alumnos`, así invalidar los alumnos la alcanza. */
export const usuarioSugeridoKey = (datos: DatosUsuarioSugerido) =>
  [...alumnosKeys.all, 'usuario-sugerido', datos] as const

/** El usuario que se le asignaría (es una sugerencia: el definitivo se calcula al guardar). */
export function obtenerUsuarioSugerido(datos: DatosUsuarioSugerido): Promise<{ usuario: string }> {
  const qs = new URLSearchParams(datos).toString()
  return fetchJson<{ usuario: string }>(`${BASE}/usuario-sugerido?${qs}`)
}

/** Crea el acceso de un alumno que no lo tiene (201, con el detalle). */
export function crearAcceso(alumnoId: number): Promise<AlumnoDetalle> {
  return fetchJson<AlumnoDetalle>(`${BASE}/${alumnoId}/acceso`, { method: 'POST' })
}

/** La contraseña vuelve a ser el DNI del alumno (200, con el detalle). */
export function restablecerContrasena(alumnoId: number): Promise<AlumnoDetalle> {
  return fetchJson<AlumnoDetalle>(`${BASE}/${alumnoId}/acceso/restablecimiento`, {
    method: 'POST',
  })
}
