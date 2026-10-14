import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as adjuntosController from './adjuntos.controller'
import { adjuntoSubidoSchema, subirAdjuntoSchema } from './adjuntos.validation'

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

export const adjuntosRoutes = createRouter().openapi(subirAdjuntoRoute, adjuntosController.subir)
