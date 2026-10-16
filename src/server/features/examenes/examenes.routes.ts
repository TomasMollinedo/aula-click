import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as examenesController from './examenes.controller'
import {
  ejemploAlta,
  ejemploDetalle,
  ejemploDetalleConNota,
  ejemploEdicion,
  ejemploErrorMateriaInactiva,
  ejemploErrorMateriaSinTurnos,
  ejemploErrorExamenFuturo,
  ejemploErrorPendiente,
  ejemploListado,
  ejemploMisExamenes,
  ejemploNota,
  ejemploSelector,
} from './examenes.ejemplos'
import {
  cargarNotaSchema,
  crearExamenSchema,
  editarExamenSchema,
  examenDetalleSchema,
  examenesListadoSchema,
  examenesQuerySchema,
  examenIdParamsSchema,
  materiasExamenSelectorSchema,
  misExamenesQuerySchema,
  misExamenesSchema,
} from './examenes.validation'

// Contrato HTTP de exámenes (HU-17, T-55; nota y portal, HU-34 y HU-35, T-106): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-32 y ya está registrado en `app.ts`.

const tags = ['Exámenes']
const roles = ['MESA_ENTRADAS', 'PROFESOR'] as const

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
  403: respuestaError(
    'El rol no es mesa de entradas ni profesor, el usuario está inhabilitado, o el profesor no dicta esa materia a ese alumno (SIN_PERMISO)',
  ),
}
const noEncontrado = respuestaError('El examen no existe (NO_ENCONTRADO)')

/** 409 de `crear` y `editar`: materia inactiva, sin turnos o examen pendiente, con un ejemplo de cada uno. */
const conflicto409 = {
  description:
    'La materia está inactiva (MATERIA_INACTIVA), el alumno no tiene turnos próximos de esa materia (MATERIA_SIN_TURNOS), o ya hay un examen pendiente de esa materia (EXAMEN_PENDIENTE): el existente va en `details`, para ofrecer editarlo',
  content: {
    'application/json': {
      schema: ErrorResponseSchema,
      examples: {
        materiaInactiva: { summary: 'Materia inactiva', value: ejemploErrorMateriaInactiva },
        materiaSinTurnos: { summary: 'Materia sin turnos', value: ejemploErrorMateriaSinTurnos },
        examenPendiente: { summary: 'Examen pendiente', value: ejemploErrorPendiente },
      },
    },
  },
}

const detalle = (description: string) => ({
  description,
  content: { 'application/json': { schema: examenDetalleSchema, example: ejemploDetalle } },
})

export const listarExamenesRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Exámenes de un alumno',
  description:
    'Exámenes `ACTIVO` del alumno, separados en `proximos` (fecha de hoy en adelante, orden ascendente, con `diasRestantes`) y `pasados`. Cada uno trae su materia, la auditoría con el rol de quien lo cargó y de quien lo modificó por última vez, y `administrable` (si quien consulta puede editarlo y darlo de baja).',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: { query: examenesQuerySchema },
  responses: {
    200: {
      description: 'Exámenes del alumno',
      content: { 'application/json': { schema: examenesListadoSchema, example: ejemploListado } },
    },
    ...errores,
  },
})

// Va antes de `/{id}` para que `/materias` no entre por el path con parámetro.
export const materiasExamenRoute = createRoute({
  method: 'get',
  path: '/materias',
  tags,
  summary: 'Materias ofrecibles para cargarle un examen nuevo a un alumno',
  description:
    'Materias activas en las que el alumno tiene algún turno vigente (al menos una fecha no cancelada de hoy en adelante). Mesa de entradas: las de todos sus turnos. Profesor: sólo las de los turnos que el alumno tiene con él. Sin turnos próximos, la lista viene vacía.',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: { query: examenesQuerySchema },
  responses: {
    200: {
      description: 'Materias ofrecibles',
      content: {
        'application/json': { schema: materiasExamenSelectorSchema, example: ejemploSelector },
      },
    },
    ...errores,
  },
})

export const crearExamenRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Cargar un examen',
  description:
    'Alumno, materia y fecha son obligatorios; las observaciones son opcionales (hasta 500 caracteres). La fecha puede ser pasada: la respuesta trae `pasado: true` para que el front avise. Un profesor sólo puede cargarlo en una materia que le dicte a ese alumno. La materia tiene que ser una de las ofrecibles (`GET /examenes/materias`): el alumno tiene que tener algún turno próximo en ella. No se puede cargar un segundo examen pendiente (fecha de hoy en adelante) de la misma materia: se ofrece editar el existente.',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: crearExamenSchema, example: ejemploAlta } },
    },
  },
  responses: {
    201: detalle('Examen cargado'),
    ...errores,
    404: respuestaError('El alumno o la materia no existen (NO_ENCONTRADO)'),
    409: conflicto409,
  },
})

export const editarExamenRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags,
  summary: 'Editar un examen',
  description:
    'Edición parcial: lo omitido no cambia. Si cambia la materia o la fecha, se vuelve a chequear que no haya otro examen pendiente de la materia resultante (sin contar este examen). No se puede mover a una materia inactiva, a una en la que el alumno no tenga turnos próximos (la que ya tenía se conserva aunque no los tenga) ni, si es profesor, a una que no le dicte a este alumno.',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: {
    params: examenIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: editarExamenSchema, example: ejemploEdicion } },
    },
  },
  responses: {
    200: detalle('Examen editado'),
    ...errores,
    404: noEncontrado,
    409: conflicto409,
  },
})

export const darDeBajaExamenRoute = createRoute({
  method: 'patch',
  path: '/{id}/baja',
  tags,
  summary: 'Eliminar (dar de baja) un examen',
  description:
    '"Eliminar" un examen (HU-17) es darlo de baja: pasa a `INACTIVO`, deja de contar para el pendiente de su materia y para la prioridad de los turnos, y deja de listarse. Nada se borra. El front confirma antes de llamarlo.',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: { params: examenIdParamsSchema },
  responses: {
    200: detalle('Examen dado de baja'),
    ...errores,
    404: noEncontrado,
  },
})

export const cargarNotaRoute = createRoute({
  method: 'patch',
  path: '/{id}/nota',
  tags,
  summary: 'Cargar o corregir la nota de un examen',
  description:
    'Sólo de un examen ya rendido (fecha hoy o anterior). `CON_NOTA` lleva una nota de 1 a 10 con hasta dos decimales; `AUSENTE` va sin nota y no cuenta para los promedios. Cargar y corregir usan las mismas reglas; la nota tiene su propia trazabilidad (quién la cargó y quién la modificó por última vez, con el rol) y no cambia la auditoría del examen. Un profesor sólo puede cargarla en una materia que le dicte a ese alumno. Las observaciones se siguen editando con `PATCH /examenes/{id}`.',
  middleware: [requireAuth(), requireRole(...roles)] as const,
  request: {
    params: examenIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: cargarNotaSchema, example: ejemploNota } },
    },
  },
  responses: {
    200: {
      description: 'Nota cargada',
      content: {
        'application/json': { schema: examenDetalleSchema, example: ejemploDetalleConNota },
      },
    },
    ...errores,
    404: noEncontrado,
    409: respuestaError('El examen todavía no se rindió (EXAMEN_FUTURO)', ejemploErrorExamenFuturo),
  },
})

// Portal (HU-35): el alumno sale de la sesión, nunca de un parámetro.
export const misExamenesRoute = createRoute({
  method: 'get',
  path: '/mis-examenes',
  tags,
  summary: 'Mis exámenes y notas de una materia (portal del alumno)',
  description:
    'El alumno de la sesión: el próximo examen de la materia (a lo sumo uno) con los días que faltan, los rendidos del más reciente al más antiguo (la nota, ausente o sin nota) y el promedio de las notas sin los ausentes. Sin observaciones ni auditoría.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: { query: misExamenesQuerySchema },
  responses: {
    200: {
      description: 'Mis exámenes',
      content: { 'application/json': { schema: misExamenesSchema, example: ejemploMisExamenes } },
    },
    400: errores[400],
    401: errores[401],
    403: respuestaError(
      'El rol no es alumno, el usuario está inhabilitado o la cuenta no tiene alumno (SIN_PERMISO)',
    ),
  },
})

export const examenesRoutes = createRouter()
  .openapi(listarExamenesRoute, examenesController.listar)
  .openapi(misExamenesRoute, examenesController.misExamenes)
  .openapi(materiasExamenRoute, examenesController.materias)
  .openapi(cargarNotaRoute, examenesController.cargarNota)
  .openapi(crearExamenRoute, examenesController.crear)
  .openapi(editarExamenRoute, examenesController.editar)
  .openapi(darDeBajaExamenRoute, examenesController.darDeBaja)
