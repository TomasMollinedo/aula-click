import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as materiasController from './materias.controller'
import {
  ejemploAlta,
  ejemploDetalle,
  ejemploEdicion,
  ejemploErrorConProfesores,
  ejemploErrorNombre,
  ejemploErrorSinPrecio,
  ejemploListado,
  ejemploSelector,
} from './materias.ejemplos'
import {
  crearMateriaSchema,
  editarMateriaSchema,
  listarMateriasQuerySchema,
  materiaDetalleSchema,
  materiaIdParamsSchema,
  materiasListadoSchema,
  materiasSelectorSchema,
} from './materias.validation'

// Contrato HTTP de materias: cada endpoint se declara con createRoute() y se registra acá.
// El catálogo lo administra el gerente (HU-12); mesa de entradas conserva la lectura.

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
}
const erroresLectura = {
  ...errores,
  403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
}
const erroresEscritura = {
  ...errores,
  403: respuestaError('El rol no es gerente, o el usuario está inhabilitado'),
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
    'Listado paginado ordenado por nombre, con el precio por hora (`sinPrecio: true` si no tiene). `q` busca por palabras sobre el nombre y `estado` filtra por estado (`ACTIVO` por defecto; `TODOS` no filtra).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { query: listarMateriasQuerySchema },
  responses: {
    200: {
      description: 'Página de materias',
      content: { 'application/json': { schema: materiasListadoSchema, example: ejemploListado } },
    },
    ...erroresLectura,
  },
})

// Va antes de `/{id}` para que `/selector` no entre por el path con parámetro.
export const selectorMateriasRoute = createRoute({
  method: 'get',
  path: '/selector',
  tags,
  summary: 'Selector de materias activas',
  description:
    'Materias activas ordenadas por nombre, sin paginar: es un selector de catálogo, para los dropdowns de asignaciones y turnos. Toda materia activa tiene precio.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  responses: {
    200: {
      description: 'Materias activas',
      content: { 'application/json': { schema: materiasSelectorSchema, example: ejemploSelector } },
    },
    ...erroresLectura,
  },
})

export const obtenerMateriaRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de una materia',
  description:
    'Datos de la materia con su precio por hora, los profesores que la dictan (asignaciones activas) y quién la creó y modificó.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { params: materiaIdParamsSchema },
  responses: {
    200: detalle('Detalle de la materia'),
    ...erroresLectura,
    404: noEncontrada,
  },
})

export const crearMateriaRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Dar de alta una materia',
  description:
    'Solo el gerente. Nombre y precio por hora son obligatorios; la descripción es opcional. El nombre es único: la comparación no distingue mayúsculas ni tildes ("Matemática" y "matematica" son la misma). El precio es un número mayor a 0 con hasta dos decimales.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: crearMateriaSchema, example: ejemploAlta } },
    },
  },
  responses: {
    201: detalle('Materia creada'),
    ...erroresEscritura,
    409: nombreDuplicado,
  },
})

export const editarMateriaRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags,
  summary: 'Editar una materia',
  description:
    'Solo el gerente. Edición parcial de nombre, descripción y precio por hora, con las mismas validaciones del alta: lo omitido no cambia, `descripcion: null` la borra y el precio no acepta `null`. Se puede editar una materia inactiva (por ejemplo, para cargarle el precio antes de reactivarla). Cambiar el precio no modifica los pagos ya registrados.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: {
    params: materiaIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: editarMateriaSchema, example: ejemploEdicion } },
    },
  },
  responses: {
    200: detalle('Materia editada'),
    ...erroresEscritura,
    404: noEncontrada,
    409: nombreDuplicado,
  },
})

export const darDeBajaMateriaRoute = createRoute({
  method: 'patch',
  path: '/{id}/baja',
  tags,
  summary: 'Dar de baja una materia',
  description:
    'Solo el gerente. Baja lógica: pasa a `INACTIVO` y deja de aparecer en el listado por defecto y en el selector. Si tiene profesores asignados responde 409 `MATERIA_CON_PROFESORES` con ellos en `details`.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { params: materiaIdParamsSchema },
  responses: {
    200: detalle('Materia dada de baja'),
    ...erroresEscritura,
    404: noEncontrada,
    409: respuestaError(
      'La materia tiene profesores asignados (MATERIA_CON_PROFESORES)',
      ejemploErrorConProfesores,
    ),
  },
})

export const reactivarMateriaRoute = createRoute({
  method: 'patch',
  path: '/{id}/reactivacion',
  tags,
  summary: 'Reactivar una materia',
  description:
    'Solo el gerente. Vuelve la materia a `ACTIVO`: aparece otra vez en el listado por defecto y en el selector, y se puede asignar a profesores y usar para registrar turnos. Si no tiene precio responde 409 `MATERIA_SIN_PRECIO`: primero hay que cargarlo con `PATCH /materias/{id}`. Si ya estaba activa, responde 200 igual.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { params: materiaIdParamsSchema },
  responses: {
    200: detalle('Materia reactivada'),
    ...erroresEscritura,
    404: noEncontrada,
    409: respuestaError('La materia no tiene precio (MATERIA_SIN_PRECIO)', ejemploErrorSinPrecio),
  },
})

export const materiasRoutes = createRouter()
  .openapi(listarMateriasRoute, materiasController.listar)
  .openapi(selectorMateriasRoute, materiasController.selector)
  .openapi(obtenerMateriaRoute, materiasController.obtener)
  .openapi(crearMateriaRoute, materiasController.crear)
  .openapi(editarMateriaRoute, materiasController.editar)
  .openapi(darDeBajaMateriaRoute, materiasController.darDeBaja)
  .openapi(reactivarMateriaRoute, materiasController.reactivar)
