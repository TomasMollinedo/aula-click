import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as alumnosController from './alumnos.controller'
import {
  ejemploAltaAdulto,
  ejemploAltaMenor,
  ejemploDetalle,
  ejemploEdicion,
  ejemploErrorDni,
  ejemploErrorTutor,
  ejemploListado,
  ejemploMisAlumnos,
} from './alumnos.ejemplos'
import {
  alumnoDetalleSchema,
  alumnoIdParamsSchema,
  alumnosDeProfesorListadoSchema,
  alumnosListadoSchema,
  crearAlumnoSchema,
  editarAlumnoSchema,
  listarAlumnosQuerySchema,
  listarMisAlumnosQuerySchema,
} from './alumnos.validation'

// Contrato HTTP de alumnos: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Alumnos']

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
const noEncontrado = respuestaError('El alumno no existe (NO_ENCONTRADO)')
const dniDuplicado = respuestaError('Ya existe un alumno con ese DNI (CONFLICTO)', ejemploErrorDni)
const validacionConTutor = respuestaError(
  'Datos de entrada inválidos (VALIDACION): formato, fecha de nacimiento futura o datos del tutor faltantes en un menor',
  ejemploErrorTutor,
)

const detalle = (description: string) => ({
  description,
  content: { 'application/json': { schema: alumnoDetalleSchema, example: ejemploDetalle } },
})

export const listarAlumnosRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Listar alumnos',
  description:
    'Listado paginado ordenado por apellido y nombre. `q` busca por palabras sobre apellido, nombre y DNI.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listarAlumnosQuerySchema },
  responses: {
    200: {
      description: 'Página de alumnos',
      content: { 'application/json': { schema: alumnosListadoSchema, example: ejemploListado } },
    },
    ...errores,
  },
})

// Se registra antes de `/{id}`: si no, `/mis-alumnos` caería en ese path param (ver el mismo
// cuidado en `turnos.routes.ts` con `/agenda`, `/materias` y `/aulas` antes de `/{turnoId}`).
export const listarMisAlumnosRoute = createRoute({
  method: 'get',
  path: '/mis-alumnos',
  tags,
  summary: 'Alumnos del profesor de la sesión',
  description:
    'Listado paginado de los alumnos con al menos un turno vigente (activo y no vencido) con el profesor de la sesión (sale del `Actor`, nunca de un parámetro). Mismo orden y búsqueda que el listado general; `materiaId` acota a una sola materia. Cada alumno trae también `materias`: todas las que cursa vigente con este profesor (no solo la del filtro), para que se entienda por qué aparece.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { query: listarMisAlumnosQuerySchema },
  responses: {
    200: {
      description: 'Página de alumnos del profesor (arreglo vacío si no tiene ninguno)',
      content: {
        'application/json': { schema: alumnosDeProfesorListadoSchema, example: ejemploMisAlumnos },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es profesor o el usuario está inhabilitado'),
    404: respuestaError('El usuario de la sesión no tiene ficha de profesor (NO_ENCONTRADO)'),
  },
})

export const obtenerAlumnoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de un alumno',
  description: 'Todos los datos del alumno, si es menor de edad y quién lo creó y modificó.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    200: detalle('Detalle del alumno'),
    ...errores,
    404: noEncontrado,
  },
})

export const crearAlumnoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Dar de alta un alumno',
  description:
    'Obligatorios: nombre, apellido, DNI, fecha de nacimiento, email y teléfono. Si es menor de edad, también nombre, apellido, teléfono y email del tutor.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearAlumnoSchema,
          examples: {
            adulto: { summary: 'Adulto con los datos mínimos', value: ejemploAltaAdulto },
            menor: { summary: 'Menor con los datos del tutor', value: ejemploAltaMenor },
          },
        },
      },
    },
  },
  responses: {
    201: detalle('Alumno creado'),
    ...errores,
    400: validacionConTutor,
    409: dniDuplicado,
  },
})

export const editarAlumnoRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags,
  summary: 'Editar un alumno',
  description:
    'Edición parcial: lo omitido no cambia y `null` borra un dato opcional. Las reglas del tutor se evalúan sobre el alumno resultante.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: alumnoIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: editarAlumnoSchema, example: ejemploEdicion } },
    },
  },
  responses: {
    200: detalle('Alumno actualizado'),
    ...errores,
    400: validacionConTutor,
    404: noEncontrado,
    409: dniDuplicado,
  },
})

export const alumnosRoutes = createRouter()
  .openapi(listarAlumnosRoute, alumnosController.listar)
  .openapi(listarMisAlumnosRoute, alumnosController.listarMisAlumnos)
  .openapi(obtenerAlumnoRoute, alumnosController.obtener)
  .openapi(crearAlumnoRoute, alumnosController.crear)
  .openapi(editarAlumnoRoute, alumnosController.editar)
