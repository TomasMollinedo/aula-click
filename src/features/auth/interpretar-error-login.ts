const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos'
const MENSAJE_INESPERADO = 'No se pudo iniciar sesión. Intentá de nuevo en unos minutos.'

// Forma mínima del error de authClient.signIn.email (better-fetch: status del response + body).
export interface ErrorDeLogin {
  status?: number
  code?: string
  message?: string
}

// Único lugar que decide qué mensaje ve el usuario cuando falla el login. Nunca dice qué campo
// falló ni si el email existe.
export function interpretarErrorLogin(error: ErrorDeLogin): string {
  // TODO(T-03): distinguir profesor inactivo cuando se mergee feat/auth-api — ver docs/contrato-api.md
  // Better Auth responde 401 con code INVALID_EMAIL_OR_PASSWORD; el code del usuario inhabilitado
  // lo define T-03 y todavía no está en el contrato.
  if (error.status !== undefined && error.status >= 500) return MENSAJE_INESPERADO
  return MENSAJE_CREDENCIALES
}
