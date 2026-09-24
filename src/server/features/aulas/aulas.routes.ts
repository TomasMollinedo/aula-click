import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as aulasController from './aulas.controller'
import { aulasDisponiblesQuerySchema, aulasDisponiblesSchema } from './aulas.validation'

// Contrato HTTP de aulas: cada endpoint se declara con createRoute() y se registra acá.
// Solo lectura: las aulas no tienen ABM en este release (T-28).

const tags = ['Aulas']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const aulasDisponiblesRoute = createRoute({
  method: 'get',
  path: '/disponibles',
  tags,
  summary: 'Aulas disponibles en un horario',
  description:
    'Aulas activas libres durante todo el horario pedido ese día de la semana (ninguna de sus horas ocupada por un bloque activo de cualquier profesor), ordenadas por nombre, sin paginar: es un selector. Arreglo vacío si no hay ninguna. `excluirBloqueId` saca esa fila de la ocupación (edición).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: aulasDisponiblesQuerySchema },
  responses: {
    200: {
      description: 'Aulas disponibles (arreglo vacío si no hay ninguna)',
      content: {
        'application/json': {
          schema: aulasDisponiblesSchema,
          example: [
            { id: 1, nombre: 'Aula 1', capacidad: 8 },
            { id: 3, nombre: 'Aula 3', capacidad: 10 },
          ],
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)', {
      error: {
        code: 'VALIDACION',
        message: 'Datos de entrada inválidos',
        details: [
          {
            code: 'custom',
            path: ['horaFin'],
            message: 'La hora de fin debe ser posterior a la de inicio',
          },
        ],
      },
    }),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
  },
})

export const aulasRoutes = createRouter().openapi(
  aulasDisponiblesRoute,
  aulasController.disponibles,
)
