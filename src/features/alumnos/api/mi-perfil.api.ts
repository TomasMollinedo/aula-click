import { fetchJson } from '@/utils/fetch-json'

import { alumnosKeys } from './alumnos.keys'

// Perfil del alumno de la sesión para el menú del portal (HU-28, docs/contrato-api.md → Alumnos →
// Perfil del portal). No recibe ningún `alumnoId`: la API lo toma de la sesión.

export type MiPerfil = {
  nombre: string
  apellido: string
  usuario: string
  /** URL prefirmada (vive 15 min) o `null` si no tiene foto. */
  fotoUrl: string | null
}

/** Cuelga de `alumnos`: invalidar los alumnos la alcanza. */
export const miPerfilKey = () => [...alumnosKeys.all, 'mi-perfil'] as const

export function obtenerMiPerfil(): Promise<MiPerfil> {
  return fetchJson<MiPerfil>('/api/v1/alumnos/mi-perfil')
}
