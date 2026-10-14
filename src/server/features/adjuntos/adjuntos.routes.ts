import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as adjuntosController from './adjuntos.controller'
import {
  adjuntoDePagoSchema,
  adjuntoSubidoSchema,
  pagoIdParamsSchema,
  reemplazarAdjuntoSchema,
  subirAdjuntoSchema,
} from './adjuntos.validation'

// Contrato HTTP del comprobante adjunto de un pago (HU-24, T-95): cada endpoint se declara con
// createRoute() y se registra acá.

const tags = ['Adjuntos']

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

const errorArchivo = respuestaError(
  'El archivo no es JPG, PNG o PDF (también si su contenido no corresponde a su tipo) o supera los 5 MB (VALIDACION)',
  {
    error: {
      code: 'VALIDACION',
      message: 'Datos de entrada inválidos',
      details: [{ path: ['archivo'], message: 'El archivo supera los 5 MB' }],
    },
  },
)

export const subirAdjuntoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Subir un comprobante adjunto',
  description:
    'Multipart con un único campo `archivo` (JPG, PNG o PDF de hasta 5 MB; se verifica también el contenido). Se sube **antes** de registrar el pago: queda sin pago hasta que `POST /pagos` lo vincula con `comprobanteAdjuntoId`. Uno que nunca se vincula queda guardado y no se muestra.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'multipart/form-data': { schema: subirAdjuntoSchema } },
    },
  },
  responses: {
    201: {
      description: 'Adjunto subido, todavía sin pago',
      content: {
        'application/json': {
          schema: adjuntoSubidoSchema,
          example: { id: 18, nombre: 'transferencia.pdf', tipo: 'application/pdf', bytes: 248312 },
        },
      },
    },
    400: errorArchivo,
    ...errores,
  },
})

const errorPagoId = respuestaError('`pagoId` inválido (VALIDACION)')
const sinAdjunto = respuestaError(
  'El pago no existe, o no tiene comprobante adjunto (NO_ENCONTRADO)',
  { error: { code: 'NO_ENCONTRADO', message: 'El pago no tiene comprobante adjunto' } },
)
const ejemploAdjuntoDePago = {
  id: 21,
  nombre: 'transferencia.pdf',
  tipo: 'application/pdf',
  bytes: 248312,
  url: 'https://minio.local/aula-click/adjuntos/3f1c….pdf?X-Amz-…',
  adjuntadoPor: { id: 'usr_mesa_01', nombre: 'Laura', apellido: 'Gómez' },
  adjuntadoEl: '2026-10-14T13:45:00.000Z',
}
const adjuntoDePago = (description: string) => ({
  description,
  content: {
    'application/json': { schema: adjuntoDePagoSchema, example: ejemploAdjuntoDePago },
  },
})

export const verAdjuntoRoute = createRoute({
  method: 'get',
  path: '/pagos/{pagoId}',
  tags,
  summary: 'Comprobante adjunto de un pago',
  description:
    'El último comprobante adjunto **activo** del pago, con una URL prefirmada (15 min) que lo abre en otra pestaña y quién lo adjuntó y cuándo. Los reemplazados se conservan pero no se muestran. Un pago anulado lo sigue mostrando. El alumno no lo ve.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { params: pagoIdParamsSchema },
  responses: {
    200: adjuntoDePago('El último adjunto activo del pago'),
    400: errorPagoId,
    401: errores[401],
    403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
    404: sinAdjunto,
  },
})

export const reemplazarAdjuntoRoute = createRoute({
  method: 'put',
  path: '/pagos/{pagoId}',
  tags,
  summary: 'Reemplazar el comprobante adjunto de un pago',
  description:
    'Multipart con el campo `archivo` (como `POST /adjuntos`). Adjunta el archivo nuevo y **conserva el anterior** (la fila y el archivo): se muestra sólo el último. En un pago con débito sin adjunto (nunca tuvo, o se quitó), lo adjunta. No aplica a un pago en efectivo ni a uno anulado.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: pagoIdParamsSchema,
    body: {
      required: true,
      content: { 'multipart/form-data': { schema: reemplazarAdjuntoSchema } },
    },
  },
  responses: {
    200: adjuntoDePago('El adjunto que queda (el nuevo), como el GET'),
    400: errorArchivo,
    ...errores,
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
    409: respuestaError(
      'El pago está anulado (PAGO_ANULADO), o su forma de pago no lleva comprobante, como efectivo (CONFLICTO)',
      {
        error: {
          code: 'PAGO_ANULADO',
          message: 'El pago está anulado: su comprobante adjunto se conserva como estaba',
        },
      },
    ),
  },
})

export const quitarAdjuntoRoute = createRoute({
  method: 'delete',
  path: '/pagos/{pagoId}',
  tags,
  summary: 'Quitar el comprobante adjunto de un pago con débito',
  description:
    'Sólo en un pago con débito, donde el comprobante es opcional (HU-24). Es una **baja lógica**: el adjunto pasa a inactivo con quién y cuándo, y no se borran la fila ni el archivo. Después, `GET` responde 404. Con transferencia no se puede (es obligatorio: se reemplaza).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: pagoIdParamsSchema },
  responses: {
    204: { description: 'Comprobante quitado (sin contenido)' },
    400: errorPagoId,
    ...errores,
    404: respuestaError(
      'El pago no existe, es en efectivo o no tiene comprobante adjunto activo (NO_ENCONTRADO)',
    ),
    409: respuestaError(
      'El pago es por transferencia (ADJUNTO_OBLIGATORIO) o está anulado (PAGO_ANULADO)',
      {
        error: {
          code: 'ADJUNTO_OBLIGATORIO',
          message: 'Un pago por transferencia no puede quedar sin comprobante: reemplazalo',
        },
      },
    ),
  },
})

export const adjuntosRoutes = createRouter()
  .openapi(subirAdjuntoRoute, adjuntosController.subir)
  .openapi(verAdjuntoRoute, adjuntosController.ver)
  .openapi(reemplazarAdjuntoRoute, adjuntosController.reemplazar)
  .openapi(quitarAdjuntoRoute, adjuntosController.quitar)
