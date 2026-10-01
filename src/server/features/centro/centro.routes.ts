import { createRoute, z } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as centroController from './centro.controller'
import { ejemploCentro } from './centro.ejemplos'
import { centroSchema } from './centro.validation'

// Contrato HTTP de `centro` (T-64, HU-11 · HU-15): los datos y el logo para el encabezado de los
// documentos oficiales (turno, agenda, comprobante, T-60). Sin tabla: son constantes del backend
// (definición G de las PO), por eso no hay 404 ni 400 en ninguno de los dos.

const tags = ['Centro']
const ROLES = ['MESA_ENTRADAS', 'PROFESOR', 'GERENTE'] as const

function respuestaError(description: string) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema } },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError(
    'El rol no es mesa de entradas, profesor o gerente, o el usuario está inhabilitado',
  ),
}

export const obtenerCentroRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Datos del centro',
  description:
    'Nombre, dirección y teléfono del centro, para el encabezado de los documentos oficiales. Constantes del backend: no hay pantalla para editarlos ni tabla donde guardarlos (definición G).',
  middleware: [requireAuth(), requireRole(...ROLES)] as const,
  responses: {
    200: {
      description: 'Datos del centro',
      content: { 'application/json': { schema: centroSchema, example: ejemploCentro } },
    },
    ...errores,
  },
})

export const obtenerLogoRoute = createRoute({
  method: 'get',
  path: '/logo',
  tags,
  summary: 'Logo del centro',
  description:
    'La imagen del logo, para el encabezado de los documentos oficiales. Se lee del archivo de la feature, con un `Cache-Control` largo (sin pantalla para reemplazarlo).',
  middleware: [requireAuth(), requireRole(...ROLES)] as const,
  responses: {
    200: {
      description: 'Imagen del logo',
      content: { 'image/svg+xml': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    ...errores,
  },
})

export const centroRoutes = createRouter()
  .openapi(obtenerCentroRoute, centroController.obtenerCentro)
  .openapi(obtenerLogoRoute, centroController.obtenerLogo)
