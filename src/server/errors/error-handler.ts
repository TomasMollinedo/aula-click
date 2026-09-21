import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from './app-error'
import type { ErrorResponse } from './error-response'

function body(code: string, message: string, details?: unknown): ErrorResponse {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } }
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(body(err.code, err.message, err.details), err.statusCode as ContentfulStatusCode)
  }

  // Errores propios de Hono (por ejemplo, JSON mal formado).
  if (err instanceof HTTPException) {
    return c.json(body('SOLICITUD_INVALIDA', err.message), err.status as ContentfulStatusCode)
  }

  // Error desconocido: se registra y se responde 500 sin exponer detalles.
  console.error(err)
  return c.json(body('ERROR_INTERNO', 'Error interno del servidor'), 500)
}

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(body('NO_ENCONTRADO', 'Ruta no encontrada'), 404)
