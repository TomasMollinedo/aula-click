// Códigos de error de la API que el frontend reconoce. Los valores los fija el contrato
// (docs/contrato-api.md → Errores y Autenticación); se redeclaran acá porque el frontend no puede
// importar `@/lib/auth-reglas` (ESLint). Si cambian allá, se cambian acá en el mismo PR.

/** 401 del login: email inexistente o contraseña incorrecta, sin distinguir cuál. */
export const INVALID_EMAIL_OR_PASSWORD = 'INVALID_EMAIL_OR_PASSWORD'

/** 403 del usuario inactivo, tanto en el login como en `/api/v1` con la sesión abierta. */
export const USUARIO_INHABILITADO = 'USUARIO_INHABILITADO'
