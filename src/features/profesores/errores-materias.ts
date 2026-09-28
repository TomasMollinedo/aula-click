import type { ApiError } from '@/utils/fetch-json'

// Errores de asignar y quitar materias de un profesor en lo que muestra la UI
// (docs/contrato-api.md → Errores). Sin campos de formulario: los diálogos muestran un mensaje.

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

/** Mensajes de una lista de `details` con la forma de Zod (`{ path, message }`). */
function mensajesDeDetalles(details: unknown[]): string[] {
  return details.flatMap((d) => (esRegistro(d) && typeof d.message === 'string' ? [d.message] : []))
}

/**
 * Mensaje de un error al asignar o quitar materias:
 * - `PROFESOR_INACTIVO` (asignar): el mensaje de la API tal cual.
 * - `MATERIA_INACTIVA`, `CONFLICTO` (asignar) y `NO_ENCONTRADO`, `TURNOS_VIGENTES` (quitar): el
 *   mensaje general más una línea por materia, si `details` trae un mensaje por cada una.
 * - Resto (401, 403, 500...): el mensaje de la API.
 */
export function textoErrorMaterias(error: ApiError): string {
  const details = Array.isArray(error.details) ? error.details : []
  const lineas = mensajesDeDetalles(details)
  return lineas.length > 0 ? `${error.message}: ${lineas.join('; ')}` : error.message
}
