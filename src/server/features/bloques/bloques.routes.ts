import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as bloquesController from './bloques.controller'
import {
  bloqueIdParamsSchema,
  bloqueSchema,
  bloquesCreadosSchema,
  crearBloqueSchema,
  editarBloqueSchema,
} from './bloques.validation'

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

const noEncontrado = respuestaError('El bloque no existe (NO_ENCONTRADO)')

export const editarBloqueRoute = createRoute({
  method: 'patch',
  path: '/{bloqueId}',
  tags,
  summary: 'Editar un bloque de horario',
  description:
    'Edita día, horario y/o aula de esa hora puntual (el profesor no se edita). Edición parcial: lo omitido no cambia. Mismas validaciones que el alta, más el chequeo de turnos vigentes.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: bloqueIdParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: editarBloqueSchema,
          example: { horaInicio: '15:00', horaFin: '16:00' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Bloque editado',
      content: {
        'application/json': {
          schema: bloqueSchema,
          example: {
            id: 10,
            diaSemana: 1,
            horaInicio: '15:00',
            horaFin: '16:00',
            aula: { id: 3, nombre: 'Aula 3' },
          },
        },
      },
    },
    ...errores,
    404: noEncontrado,
    409: respuestaError(
      'Profesor inactivo, sin materias, bloque superpuesto, aula ocupada, o turnos vigentes que impiden editarlo (TURNOS_VIGENTES)',
      {
        error: {
          code: 'TURNOS_VIGENTES',
          message: 'No se puede editar un bloque con turnos vigentes',
          details: { cantidad: 2 },
        },
      },
    ),
  },
})

export const eliminarBloqueRoute = createRoute({
  method: 'delete',
  path: '/{bloqueId}',
  tags,
  summary: 'Dar de baja un bloque de horario',
  description:
    'Baja lógica de esa hora puntual (`estado = INACTIVO`), nunca borrado físico. Se puede dar de baja aunque el profesor esté inactivo.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: bloqueIdParamsSchema },
  responses: {
    200: {
      description: 'Bloque dado de baja',
      content: {
        'application/json': {
          schema: bloqueSchema,
          example: {
            id: 10,
            diaSemana: 1,
            horaInicio: '14:00',
            horaFin: '15:00',
            aula: { id: 3, nombre: 'Aula 3' },
          },
        },
      },
    },
    ...errores,
    404: noEncontrado,
    409: respuestaError('Turnos o excepciones vigentes que impiden la baja (TURNOS_VIGENTES)', {
      error: {
        code: 'TURNOS_VIGENTES',
        message: 'No se puede modificar un bloque con turnos vigentes',
        details: { cantidad: 2 },
      },
    }),
  },
})

export const bloquesRoutes = createRouter()
  .openapi(crearBloqueRoute, bloquesController.crear)
  .openapi(editarBloqueRoute, bloquesController.editar)
  .openapi(eliminarBloqueRoute, bloquesController.eliminar)
