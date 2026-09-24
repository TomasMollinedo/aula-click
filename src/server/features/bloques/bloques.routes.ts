import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as bloquesController from './bloques.controller'
import { bloquesCreadosSchema, crearBloqueSchema } from './bloques.validation'

// Contrato HTTP de bloques: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Bloques']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

export const crearBloqueRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Cargar un bloque de horario a un profesor',
  description:
    'Un rango de varias horas (por ejemplo 14:00 a 18:00) crea una fila por cada hora, todas o ninguna. Cada error informa todas las horas en conflicto, no solo la primera.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearBloqueSchema,
          example: {
            profesorId: 3,
            diaSemana: 1,
            horaInicio: '14:00',
            horaFin: '18:00',
            aulaId: 3,
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Filas creadas (una por hora)',
      content: {
        'application/json': {
          schema: bloquesCreadosSchema,
          example: {
            cantidad: 4,
            bloques: [
              {
                id: 10,
                diaSemana: 1,
                horaInicio: '14:00',
                horaFin: '15:00',
                aula: { id: 3, nombre: 'Aula 3' },
              },
            ],
          },
        },
      },
    },
    ...errores,
    404: respuestaError('El profesor o el aula no existen (NO_ENCONTRADO)'),
    409: respuestaError(
      'Profesor inactivo (PROFESOR_INACTIVO), sin materias asignadas (PROFESOR_SIN_MATERIAS), bloque superpuesto (BLOQUE_SUPERPUESTO) o aula ocupada (AULA_OCUPADA)',
      {
        error: {
          code: 'AULA_OCUPADA',
          message: 'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
          details: [{ diaSemana: 1, horaInicio: '15:00', horaFin: '16:00', profesorId: 7 }],
        },
      },
    ),
  },
})

export const bloquesRoutes = createRouter().openapi(crearBloqueRoute, bloquesController.crear)
