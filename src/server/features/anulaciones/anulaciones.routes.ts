import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as anulacionesController from './anulaciones.controller'
import {
  ejemploAnular,
  ejemploErrorPagoAnulado,
  ejemploPagoAnulado,
  ejemploPrevia,
} from './anulaciones.ejemplos'
import {
  anularPagoSchema,
  pagoAnuladoSchema,
  previaAnulacionSchema,
  previaQuerySchema,
} from './anulaciones.validation'

// Contrato HTTP de anulaciones (HU-42, T-104): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-72 y ya está registrado en `app.ts`.

const tags = ['Anulaciones']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const previaAnulacionRoute = createRoute({
  method: 'get',
  path: '/previa',
  tags,
  summary: 'Confirmación de la anulación de un pago',
  description:
    'El resumen para confirmar ("¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000 (4 turnos)?") y los avisos, que informan sin bloquear: `deuda` (el alumno quedaría con deuda vencida), `precios` (por materia, el precio vigente es distinto del cobrado) y `transferenciaCompartida` (otros pagos vigentes con la misma operación y banco, que no se anulan con éste). No escribe nada.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: previaQuerySchema },
  responses: {
    200: {
      description: 'Resumen del pago y avisos',
      content: { 'application/json': { schema: previaAnulacionSchema, example: ejemploPrevia } },
    },
    400: respuestaError('`pagoId` ausente o inválido (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
    409: respuestaError('El pago ya está anulado (PAGO_ANULADO)', ejemploErrorPagoAnulado),
  },
})

export const anularPagoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Anular un pago',
  description:
    'Anula el pago completo, nunca un turno suelto: `Pago.estado = ANULADO`, una `AnulacionPago` y `vigente = null` en sus turnos, que vuelven a estar pendientes de pago y se pueden cobrar de nuevo al precio vigente. El pago conserva todos sus datos, su forma de pago y su comprobante adjunto; su número no se reutiliza. No se deshace.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: anularPagoSchema, example: ejemploAnular } },
    },
  },
  responses: {
    201: {
      description: 'Pago anulado',
      content: { 'application/json': { schema: pagoAnuladoSchema, example: ejemploPagoAnulado } },
    },
    400: respuestaError(
      'Datos inválidos (VALIDACION): formato, motivo fuera del enum, o `detalle` de más de 500 caracteres u obligatorio con `motivo = OTRO`',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
    409: respuestaError('El pago ya está anulado (PAGO_ANULADO)', ejemploErrorPagoAnulado),
  },
})

export const anulacionesRoutes = createRouter()
  .openapi(previaAnulacionRoute, anulacionesController.previa)
  .openapi(anularPagoRoute, anulacionesController.anular)
