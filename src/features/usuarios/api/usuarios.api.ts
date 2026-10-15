import { fetchJson } from '@/utils/fetch-json'

import type { CambiarContrasenaBody, MiUsuario } from '../usuarios.types'

const BASE = '/api/v1/usuarios'

/** El usuario de la sesión, con `contrasenaInicial`. */
export function obtenerMiUsuario(): Promise<MiUsuario> {
  return fetchJson<MiUsuario>(`${BASE}/mi-usuario`)
}

/** Cambia la contraseña del usuario de la sesión. La sesión sigue abierta. */
export function cambiarContrasena(datos: CambiarContrasenaBody): Promise<MiUsuario> {
  return fetchJson<MiUsuario>(`${BASE}/mi-usuario/contrasena`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
