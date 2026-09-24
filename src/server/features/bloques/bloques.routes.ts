import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as bloquesController from './bloques.controller'
import {
  bloqueIdParamsSchema,
  bloqueSchema,
  bloquesLoteSchema,
  crearBloqueSchema,
  editarBloqueSchema,
  eliminarBloquesSchema,
  horarioSchema,
  listarBloquesQuerySchema,
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

export const listarBloquesRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Horario semanal de un profesor',
  description:
    'Filas activas del profesor, ordenadas por día y hora, sin paginar (es un horario semanal). Cada una trae, calculadas al leer, su capacidad efectiva (`min` profesor/aula), `proximaFecha` (la próxima fecha de ese día de la semana, hoy incluido) y `ocupacion` (turnos ACTIVO de esa hora en `proximaFecha`).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listarBloquesQuerySchema },
  responses: {
    200: {
      description: 'Horario del profesor (arreglo vacío si no tiene bloques activos)',
      content: {
        'application/json': {
          schema: horarioSchema,
          example: [
            {
              id: 10,
              diaSemana: 1,
              horaInicio: '14:00',
              horaFin: '15:00',
              aula: { id: 3, nombre: 'Aula 3' },
              capacidadEfectiva: 10,
              proximaFecha: '2026-09-28',
              ocupacion: 0,
            },
          ],
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El profesor no existe (NO_ENCONTRADO)'),
  },
})

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
          schema: bloquesLoteSchema,
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
    409: respuestaError('Turnos vigentes que impiden la baja (TURNOS_VIGENTES)', {
      error: {
        code: 'TURNOS_VIGENTES',
        message: 'No se puede modificar un bloque con turnos vigentes',
        details: { cantidad: 2 },
      },
    }),
  },
})

export const eliminarBloquesRoute = createRoute({
  method: 'delete',
  path: '/',
  tags,
  summary: 'Dar de baja varias horas juntas',
  description:
    'Baja lógica (`estado = INACTIVO`) de varias filas del horario de un profesor (el bloque que la UI muestra agrupado), por ids explícitos, nunca por rango: se dan de baja todas o ninguna. Cada fila debe existir y estar activa, todas deben ser del mismo profesor y ninguna puede tener turnos vigentes. Cada error informa en `details` todas las filas que lo causan (`path` = posición en `bloqueIds`). Se puede dar de baja aunque el profesor esté inactivo.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: eliminarBloquesSchema, example: { bloqueIds: [10, 11] } },
      },
    },
  },
  responses: {
    200: {
      description: 'Filas dadas de baja, ordenadas por día y hora',
      content: {
        'application/json': {
          schema: bloquesLoteSchema,
          example: {
            cantidad: 2,
            bloques: [
              {
                id: 10,
                diaSemana: 1,
                horaInicio: '14:00',
                horaFin: '15:00',
                aula: { id: 3, nombre: 'Aula 3' },
              },
              {
                id: 11,
                diaSemana: 1,
                horaInicio: '15:00',
                horaFin: '16:00',
                aula: { id: 3, nombre: 'Aula 3' },
              },
            ],
          },
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos, o filas de más de un profesor (VALIDACION)', {
      error: {
        code: 'VALIDACION',
        message: 'Todas las horas deben ser del mismo profesor',
        details: [{ path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' }],
      },
    }),
    401: errores[401],
    403: errores[403],
    404: respuestaError('Alguna fila no existe o ya fue dada de baja (NO_ENCONTRADO)', {
      error: {
        code: 'NO_ENCONTRADO',
        message: 'Bloque no encontrado',
        details: [
          { path: ['bloqueIds', 1], message: 'El bloque 99 no existe o ya fue dado de baja' },
        ],
      },
    }),
    409: respuestaError(
      'Alguna fila tiene turnos vigentes (TURNOS_VIGENTES). `details` trae la cantidad de cada una',
      {
        error: {
          code: 'TURNOS_VIGENTES',
          message: 'No se puede modificar un bloque con turnos vigentes',
          details: [
            {
              path: ['bloqueIds', 0],
              message: 'La hora de 14:00 a 15:00 tiene 2 turnos vigentes',
              cantidad: 2,
            },
          ],
        },
      },
    ),
  },
})

export const bloquesRoutes = createRouter()
  .openapi(listarBloquesRoute, bloquesController.listar)
  .openapi(crearBloqueRoute, bloquesController.crear)
  .openapi(eliminarBloquesRoute, bloquesController.eliminarVarios)
  .openapi(editarBloqueRoute, bloquesController.editar)
  .openapi(eliminarBloqueRoute, bloquesController.eliminar)
