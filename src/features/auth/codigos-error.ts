// Códigos de error de la API que el frontend reconoce. Los valores los fija el contrato
// (docs/contrato-api.md → Errores y Autenticación); se redeclaran acá porque el frontend no puede
// importar `@/lib/auth-reglas` (ESLint). Si cambian allá, se cambian acá en el mismo PR.

/** 401 del login por email: email inexistente o contraseña incorrecta, sin distinguir cuál. */
export const INVALID_EMAIL_OR_PASSWORD = 'INVALID_EMAIL_OR_PASSWORD'

/** 401 del login por usuario (alumno): usuario inexistente o contraseña incorrecta. */
export const INVALID_USERNAME_OR_PASSWORD = 'INVALID_USERNAME_OR_PASSWORD'

/**
 * 422 del login por usuario con un usuario de largo o formato inválido. El plugin responde antes
 * de mirar la contraseña (T-75); la UI lo muestra igual que una credencial incorrecta.
 */
export const USERNAME_TOO_SHORT = 'USERNAME_TOO_SHORT'
export const USERNAME_TOO_LONG = 'USERNAME_TOO_LONG'
export const INVALID_USERNAME = 'INVALID_USERNAME'

/** 403 del usuario inactivo, tanto en el login como en `/api/v1` con la sesión abierta. */
export const USUARIO_INHABILITADO = 'USUARIO_INHABILITADO'
