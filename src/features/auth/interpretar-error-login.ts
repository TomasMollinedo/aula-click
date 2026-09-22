import { INVALID_EMAIL_OR_PASSWORD, USUARIO_INHABILITADO } from '@/features/auth/codigos-error'

const MENSAJE_INESPERADO = 'No se pudo iniciar sesión. Intentá de nuevo en unos minutos.'

const MENSAJE_POR_CODE: Record<string, string | undefined> = {
  [INVALID_EMAIL_OR_PASSWORD]: 'Usuario o contraseña incorrectos',
  [USUARIO_INHABILITADO]: 'Su usuario no está habilitado',
}

// Forma mínima del error de authClient.signIn.email: `/api/auth` responde con el formato de
// Better Auth ({ code, message }) y better-fetch le agrega el status del response.
export interface ErrorDeLogin {
  status?: number
  code?: string
  message?: string
}

/**
 * Único lugar que decide qué mensaje ve el usuario cuando falla el login. Elige por `code`: el
 * `message` de Better Auth viene en inglés y no se muestra nunca. Un `code` desconocido (5xx, error
 * de red) cae en el mensaje genérico, no en el de credenciales: decir "usuario o contraseña
 * incorrectos" cuando el problema es otro sería mentirle al usuario.
 */
export function interpretarErrorLogin(error: ErrorDeLogin): string {
  const mensaje = error.code ? MENSAJE_POR_CODE[error.code] : undefined
  return mensaje ?? MENSAJE_INESPERADO
}
