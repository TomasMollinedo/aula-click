import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as profesoresController from './profesores.controller'
import {
  asignarMateriasSchema,
  materiasAsignadasSchema,
  profesorIdParamsSchema,
  quitarMateriasSchema,
} from './profesores.validation'

// Contrato HTTP de profesores: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Profesores']

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
const noEncontrado = respuestaError('El profesor no existe (NO_ENCONTRADO)')

const ejemploMateriasAsignadas = [
  { id: 7, nombre: 'Física' },
  { id: 2, nombre: 'Matemática' },
]

const materiasAsignadas = (description: string) => ({
  description,
  content: {
    'application/json': { schema: materiasAsignadasSchema, example: ejemploMateriasAsignadas },
  },
})

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
    200: materiasAsignadas('Materias asignadas (arreglo vacío si no tiene ninguna)'),
    ...errores,
    404: noEncontrado,
  },
})

export const asignarMateriasRoute = createRoute({
  method: 'post',
  path: '/{id}/materias',
  tags,
  summary: 'Asignar materias a un profesor',
  description:
    'Asigna una o varias materias en una sola operación: se asignan todas o ninguna. El profesor debe estar activo y cada materia debe existir, estar activa y no estar ya asignada. Una asignación dada de baja se reactiva. Cada error informa en `details` todas las materias que lo causan (`path` = posición en `materiaIds`).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: profesorIdParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: asignarMateriasSchema, example: { materiaIds: [2, 7] } },
      },
    },
  },
  responses: {
    201: materiasAsignadas('Materias asignadas del profesor, ya actualizadas'),
    ...errores,
    404: respuestaError('El profesor o alguna materia no existe (NO_ENCONTRADO)', {
      error: {
        code: 'NO_ENCONTRADO',
        message: 'Materia no encontrada',
        details: [{ path: ['materiaIds', 1], message: 'La materia 99 no existe' }],
      },
    }),
    409: respuestaError(
      'Profesor inactivo (PROFESOR_INACTIVO), materia inactiva (MATERIA_INACTIVA) o materia ya asignada (CONFLICTO)',
      {
        error: {
          code: 'MATERIA_INACTIVA',
          message: 'No se pueden asignar materias inactivas',
          details: [{ path: ['materiaIds', 0], message: 'La materia Química está inactiva' }],
        },
      },
    ),
  },
})

export const quitarMateriasRoute = createRoute({
  method: 'delete',
  path: '/{id}/materias',
  tags,
  summary: 'Quitar materias a un profesor',
  description:
    'Baja lógica de una o varias asignaciones (`estado = INACTIVO`), nunca borrado físico: se quitan todas o ninguna. Cada materia debe estar asignada y activa, y el profesor no debe tener turnos vigentes (no cancelados) de ella. Volver a asignarla reactiva la misma asignación. Cada error informa en `details` todas las materias que lo causan (`path` = posición en `materiaIds`).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: profesorIdParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: quitarMateriasSchema, example: { materiaIds: [2] } },
      },
    },
  },
  responses: {
    200: materiasAsignadas('Materias asignadas del profesor, ya actualizadas'),
    ...errores,
    404: respuestaError(
      'El profesor no existe o alguna materia no le está asignada (NO_ENCONTRADO)',
      {
        error: {
          code: 'NO_ENCONTRADO',
          message: 'Materia no asignada al profesor',
          details: [
            { path: ['materiaIds', 0], message: 'La materia 9 no está asignada al profesor' },
          ],
        },
      },
    ),
    409: respuestaError(
      'Alguna materia tiene turnos vigentes del profesor (TURNOS_VIGENTES). `details` trae la cantidad de cada una',
      {
        error: {
          code: 'TURNOS_VIGENTES',
          message: 'No se pueden quitar materias con turnos vigentes',
          details: [
            {
              path: ['materiaIds', 0],
              message: 'La materia Matemática tiene 3 turnos vigentes con el profesor',
              cantidad: 3,
            },
          ],
        },
      },
    ),
  },
})

export const profesoresRoutes = createRouter()
  .openapi(listarMateriasAsignadasRoute, profesoresController.listarMateriasAsignadas)
  .openapi(asignarMateriasRoute, profesoresController.asignarMaterias)
  .openapi(quitarMateriasRoute, profesoresController.quitarMaterias)
