import type { ApiError } from '@/utils/fetch-json'

// Errores de la API de asistencias (docs/contrato-api.md → Asistencias) en lo que muestra la UI.

export const CODIGO_FUERA_DE_PLAZO = 'FUERA_DE_PLAZO'
export const CODIGO_TURNO_CANCELADO = 'TURNO_CANCELADO'

const MENSAJE_GENERICO = 'Ocurrió un error inesperado'

/** El error de cargar el día o los pendientes, para el lugar del contenido. */
export function mensajeErrorCarga(error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver la asistencia'
  if (error?.status === 404) return 'Tu usuario no tiene ficha de profesor'
  return error?.message ?? MENSAJE_GENERICO
}

/**
 * El error de guardar una fila (o "Marcar todos presentes"), que se muestra en la fila. Los 409
 * (`FUERA_DE_PLAZO`, `TURNO_CANCELADO`) y los 400 traen un `message` para personas: va tal cual.
 */
export function mensajeErrorRegistro(error: ApiError): string {
  if (error.status === 403) return 'No tenés permiso para registrar esta asistencia'
  if (error.status === 409 || error.status === 400) return error.message
  return error.message || MENSAJE_GENERICO
}
