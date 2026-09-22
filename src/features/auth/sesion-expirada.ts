// Aviso de sesión vencida: lo escribe en la URL el manejo de 401 de app/providers.tsx y lo lee
// AvisoSesionExpirada en /login.
export const MOTIVO_SESION_EXPIRADA = 'sesion_expirada'

export const URL_LOGIN_SESION_EXPIRADA = `/login?motivo=${MOTIVO_SESION_EXPIRADA}`
