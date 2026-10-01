import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as cancelacionesController from './cancelaciones.controller'
import {
  ejemploCanceladas,
  ejemploCancelar,
  ejemploErrorNoCancelables,
} from './cancelaciones.ejemplos'
import { cancelacionesCreadasSchema, cancelarTurnosSchema } from './cancelaciones.validation'

// Contrato HTTP de cancelaciones (HU-13, T-45): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-32 y ya está registrado en `app.ts`.

const tags = ['Cancelaciones']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const cancelarTurnosRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Cancelar uno o varios turnos',
  description:
    'Cancela una o varias ocurrencias `(turnoId, fecha)` de un alumno, todo o nada. Una cancelación sólo afecta a esa fecha: el resto de la serie sigue agendado y la hora vuelve a tener lugar ese día. Cancelables: estado `AGENDADO` (no cancelada, de hoy en adelante) y pago `PENDIENTE`; un turno pagado no se cancela.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: cancelarTurnosSchema, example: ejemploCancelar } },
    },
  },
  responses: {
    201: {
      description: 'Turnos cancelados',
      content: {
        'application/json': { schema: cancelacionesCreadasSchema, example: ejemploCanceladas },
      },
    },
    400: respuestaError(
      'Datos inválidos (VALIDACION): formato, ocurrencias repetidas, `detalle` de más de 500 caracteres u obligatorio con `motivo = OTRO`, u ocurrencias de más de un alumno',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    409: respuestaError(
      'Alguna ocurrencia no se puede cancelar (TURNOS_NO_CANCELABLES): `details` con cada una y su motivo (`NO_EXISTE`, `YA_CANCELADO`, `PAGADO`, `PASADO`). Sin `details` si otra cancelación la registró al mismo tiempo',
      ejemploErrorNoCancelables,
    ),
  },
})

export const cancelacionesRoutes = createRouter().openapi(
  cancelarTurnosRoute,
  cancelacionesController.cancelar,
)
