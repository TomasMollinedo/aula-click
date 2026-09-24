import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as profesoresController from './profesores.controller'
import {
  ejemploAlta,
  ejemploDetalle,
  ejemploEdicion,
  ejemploErrorDni,
  ejemploErrorFoto,
  ejemploListado,
} from './profesores.ejemplos'
import {
  asignarMateriasSchema,
  crearProfesorSchema,
  editarProfesorSchema,
  listarProfesoresQuerySchema,
  materiasAsignadasSchema,
  profesorDetalleSchema,
  profesorIdParamsSchema,
  profesoresListadoSchema,
  quitarMateriasSchema,
  subirFotoSchema,
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
const datoDuplicado = respuestaError(
  'DNI, email o matrícula repetidos (CONFLICTO)',
  ejemploErrorDni,
)

const detalle = (description: string) => ({
  description,
  content: { 'application/json': { schema: profesorDetalleSchema, example: ejemploDetalle } },
})

export const listarProfesoresRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Listar profesores',
  description:
    'Listado paginado ordenado por apellido y nombre. `q` busca por palabras sobre apellido, nombre y DNI; `estado` filtra por estado (`ACTIVO` por defecto; `TODOS` no filtra); `materiaId` filtra por materia con asignación activa.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listarProfesoresQuerySchema },
  responses: {
    200: {
      description: 'Página de profesores',
      content: { 'application/json': { schema: profesoresListadoSchema, example: ejemploListado } },
    },
    ...errores,
  },
})

export const obtenerProfesorRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de un profesor',
  description:
    'Todos los datos del profesor, su estado y quién lo creó y modificó (de su Usuario).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: profesorIdParamsSchema },
  responses: {
    200: detalle('Detalle del profesor'),
    ...errores,
    404: noEncontrado,
  },
})

export const crearProfesorRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Dar de alta un profesor',
  description:
    'Crea al profesor junto con su cuenta de usuario (rol PROFESOR), con la contraseña inicial que define mesa de entradas. Si algo falla, no queda nada creado.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: crearProfesorSchema, example: ejemploAlta } },
    },
  },
  responses: {
    201: detalle('Profesor creado'),
    ...errores,
    409: datoDuplicado,
  },
})

export const editarProfesorRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags,
  summary: 'Editar un profesor',
  description:
    'Edición parcial: lo omitido no cambia. La contraseña no se edita. Como el email es el de la cuenta, cambiarlo cambia el email de ingreso.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: profesorIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: editarProfesorSchema, example: ejemploEdicion } },
    },
  },
  responses: {
    200: detalle('Profesor actualizado'),
    ...errores,
    404: noEncontrado,
    409: datoDuplicado,
  },
})

export const subirFotoRoute = createRoute({
  method: 'post',
  path: '/{id}/foto',
  tags,
  summary: 'Subir o reemplazar la foto del profesor',
  description:
    'Multipart con un único campo `foto` (JPG o PNG, hasta 5 MB). Si ya tenía una, la reemplaza y borra la anterior.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: profesorIdParamsSchema,
    body: {
      required: true,
      content: { 'multipart/form-data': { schema: subirFotoSchema } },
    },
  },
  responses: {
    200: detalle('Profesor con la foto actualizada'),
    ...errores,
    400: respuestaError(
      'La foto no es JPG ni PNG, o supera el tamaño máximo (VALIDACION)',
      ejemploErrorFoto,
    ),
    404: noEncontrado,
  },
})

export const quitarFotoRoute = createRoute({
  method: 'delete',
  path: '/{id}/foto',
  tags,
  summary: 'Quitar la foto del profesor',
  description: 'Borra el objeto y limpia la clave. Sin foto no es un error: no cambia nada.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: profesorIdParamsSchema },
  responses: {
    200: detalle('Profesor sin foto'),
    ...errores,
    404: noEncontrado,
  },
})

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
  .openapi(listarProfesoresRoute, profesoresController.listar)
  .openapi(obtenerProfesorRoute, profesoresController.obtener)
  .openapi(crearProfesorRoute, profesoresController.crear)
  .openapi(editarProfesorRoute, profesoresController.editar)
  .openapi(subirFotoRoute, profesoresController.subirFoto)
  .openapi(quitarFotoRoute, profesoresController.quitarFoto)
  .openapi(listarMateriasAsignadasRoute, profesoresController.listarMateriasAsignadas)
  .openapi(asignarMateriasRoute, profesoresController.asignarMaterias)
  .openapi(quitarMateriasRoute, profesoresController.quitarMaterias)
