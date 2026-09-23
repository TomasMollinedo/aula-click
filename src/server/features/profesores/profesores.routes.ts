import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as profesoresController from './profesores.controller'
import { materiasAsignadasSchema, profesorIdParamsSchema } from './profesores.validation'

// Contrato HTTP de profesores: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Profesores']

function respuestaError(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponseSchema } } }
}

const errores = {
  400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}
const noEncontrado = respuestaError('El profesor no existe (NO_ENCONTRADO)')

export const listarMateriasAsignadasRoute = createRoute({
  method: 'get',
  path: '/{id}/materias',
  tags,
  summary: 'Materias asignadas a un profesor',
  description:
    'Materias con asignación activa del profesor (id y nombre), ordenadas por nombre. Sin paginar.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: profesorIdParamsSchema },
  responses: {
    200: {
      description: 'Materias asignadas (arreglo vacío si no tiene ninguna)',
      content: {
        'application/json': {
          schema: materiasAsignadasSchema,
          example: [
            { id: 7, nombre: 'Física' },
            { id: 2, nombre: 'Matemática' },
          ],
        },
      },
    },
    ...errores,
    404: noEncontrado,
  },
})

export const profesoresRoutes = createRouter().openapi(
  listarMateriasAsignadasRoute,
  profesoresController.listarMateriasAsignadas,
)
