import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as pagosController from './pagos.controller'
import {
  ejemploComprobante,
  ejemploErrorMonto,
  ejemploErrorNoCobrables,
  ejemploRegistrado,
  ejemploRegistrar,
} from './pagos.ejemplos'
import {
  comprobanteSchema,
  pagoIdParamsSchema,
  pagoRegistradoSchema,
  registrarPagoSchema,
} from './pagos.validation'

// Contrato HTTP de pagos (HU-15, T-51): cada endpoint se declara con createRoute() y se registra
// acá. El router lo creó T-32 y ya está registrado en `app.ts`.

const tags = ['Pagos']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

export const registrarPagoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Registrar el pago de uno o varios turnos',
  description:
    'Cobra en efectivo una o varias ocurrencias `(turnoId, fecha)` de un alumno, todo o nada. El importe de cada una es el precio por hora vigente de su materia; el total y el vuelto los calcula la API (el vuelto no se guarda). Cobrables: estado `AGENDADO` o `SIN_REGISTRAR`, pago `PENDIENTE`, fecha hasta hoy + 56 días y materia con precio.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: registrarPagoSchema, example: ejemploRegistrar } },
    },
  },
  responses: {
    201: {
      description: 'Pago registrado',
      content: { 'application/json': { schema: pagoRegistradoSchema, example: ejemploRegistrado } },
    },
    400: respuestaError(
      'Datos inválidos (VALIDACION): formato, ocurrencias repetidas, `montoRecibido` ausente, `fechaPago` posterior a hoy, ocurrencias de otro alumno, total mayor al máximo o `montoRecibido` menor al total',
      ejemploErrorMonto,
    ),
    ...errores,
    404: respuestaError('El alumno no existe (NO_ENCONTRADO)'),
    409: respuestaError(
      'Alguna ocurrencia no se puede cobrar (TURNOS_NO_COBRABLES): `details` con cada una y su motivo (`NO_EXISTE`, `CANCELADO`, `YA_PAGADO`, `FUERA_DE_RANGO`, `SIN_PRECIO`). Sin `details` si otro pago la registró al mismo tiempo',
      ejemploErrorNoCobrables,
    ),
  },
})

export const obtenerComprobanteRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Comprobante de un pago',
  description:
    'Datos del comprobante: número, fecha, alumno, cada turno con los datos actuales de su turno y el importe cobrado, total, monto recibido y vuelto (recalculado), forma de pago, observaciones y quién lo registró.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: pagoIdParamsSchema },
  responses: {
    200: {
      description: 'Comprobante',
      content: { 'application/json': { schema: comprobanteSchema, example: ejemploComprobante } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    ...errores,
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
  },
})

export const pagosRoutes = createRouter()
  .openapi(registrarPagoRoute, pagosController.registrar)
  .openapi(obtenerComprobanteRoute, pagosController.obtenerComprobante)
