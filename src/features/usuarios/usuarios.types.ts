import type { Role } from '@/types'

// Tipos de la API de usuarios (docs/contrato-api.md → Usuarios; HU-28, T-91).

/** `GET /usuarios/mi-usuario`: el usuario de la sesión. */
export type MiUsuario = {
  id: string
  nombre: string
  apellido: string
  role: Role
  /** Usuario de ingreso del alumno; `null` en los demás roles (ingresan con su email). */
  usuario: string | null
  /** Sigue con la contraseña que puso el sistema: el portal recomienda cambiarla. */
  contrasenaInicial: boolean
}

/** Body de `PATCH /usuarios/mi-usuario/contrasena`. */
export type CambiarContrasenaBody = { actual: string; nueva: string; repeticion: string }
