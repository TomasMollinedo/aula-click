import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as materiasController from './materias.controller'
import {
  ejemploAlta,
  ejemploDetalle,
  ejemploErrorConProfesores,
  ejemploErrorNombre,
  ejemploListado,
  ejemploSelector,
} from './materias.ejemplos'
import {
  crearMateriaSchema,
  listarMateriasQuerySchema,
  materiaDetalleSchema,
  materiaIdParamsSchema,
  materiasListadoSchema,
  materiasSelectorSchema,
} from './materias.validation'

// Contrato HTTP de materias: cada endpoint se declara con createRoute() y se registra acá.
// No hay edición en este sprint: solo alta y baja lógica (HU-03).

const tags = ['Materias']

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
const noEncontrada = respuestaError('La materia no existe (NO_ENCONTRADO)')
const nombreDuplicado = respuestaError(
  'Ya existe una materia con ese nombre (CONFLICTO)',
  ejemploErrorNombre,
)

const detalle = (description: string) => ({
  description,
  content: { 'application/json': { schema: materiaDetalleSchema, example: ejemploDetalle } },
})

export const listarMateriasRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Listar materias',
  description:
    'Listado paginado ordenado por nombre. `q` busca por palabras sobre el nombre y `estado` filtra por estado (`ACTIVO` por defecto; `TODOS` no filtra).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listarMateriasQuerySchema },
  responses: {
    200: {
      description: 'Página de materias',
      content: { 'application/json': { schema: materiasListadoSchema, example: ejemploListado } },
    },
    ...errores,
  },
})

// Va antes de `/{id}` para que `/selector` no entre por el path con parámetro.
export const selectorMateriasRoute = createRoute({
  method: 'get',
  path: '/selector',
  tags,
  summary: 'Selector de materias activas',
  description:
    'Materias activas ordenadas por nombre, sin paginar: es un selector de catálogo, para los dropdowns de asignaciones y turnos.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  responses: {
    200: {
      description: 'Materias activas',
      content: { 'application/json': { schema: materiasSelectorSchema, example: ejemploSelector } },
    },
    ...errores,
  },
})

export const obtenerMateriaRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de una materia',
  description:
    'Datos de la materia, los profesores que la dictan (asignaciones activas) y quién la creó y modificó.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: materiaIdParamsSchema },
  responses: {
    200: detalle('Detalle de la materia'),
    ...errores,
    404: noEncontrada,
  },
})

export const crearMateriaRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Dar de alta una materia',
  description:
    'El nombre es obligatorio y único: la comparación no distingue mayúsculas ni tildes ("Matemática" y "matematica" son la misma). La descripción es opcional.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: crearMateriaSchema, example: ejemploAlta } },
    },
  },
  responses: {
    201: detalle('Materia creada'),
    ...errores,
    409: nombreDuplicado,
  },
})

export const darDeBajaMateriaRoute = createRoute({
  method: 'patch',
  path: '/{id}/baja',
  tags,
  summary: 'Dar de baja una materia',
  description:
    'Baja lógica: pasa a `INACTIVO` y deja de aparecer en el listado por defecto y en el selector. Si tiene profesores asignados responde 409 `MATERIA_CON_PROFESORES` con ellos en `details`.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: materiaIdParamsSchema },
  responses: {
    200: detalle('Materia dada de baja'),
    ...errores,
    404: noEncontrada,
    409: respuestaError(
      'La materia tiene profesores asignados (MATERIA_CON_PROFESORES)',
      ejemploErrorConProfesores,
    ),
  },
})

export const materiasRoutes = createRouter()
  .openapi(listarMateriasRoute, materiasController.listar)
  .openapi(selectorMateriasRoute, materiasController.selector)
  .openapi(obtenerMateriaRoute, materiasController.obtener)
  .openapi(crearMateriaRoute, materiasController.crear)
  .openapi(darDeBajaMateriaRoute, materiasController.darDeBaja)
