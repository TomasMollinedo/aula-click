import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as cuentasController from './cuentas.controller'
import {
  ejemploAdeudados,
  ejemploCuenta,
  ejemploErrorAlumno,
  ejemploProximos,
} from './cuentas.ejemplos'
import {
  adeudadosGlobalSchema,
  alumnoIdParamsSchema,
  cuentaDelAlumnoSchema,
  filtroCuentaQuerySchema,
  listadoCuentaQuerySchema,
  proximosGlobalSchema,
} from './cuentas.validation'

// Contrato HTTP de cuentas (HU-16, T-53): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-32 y ya está registrado en `app.ts`.

const tags = ['Cuentas']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
  404: respuestaError('El alumno no existe (NO_ENCONTRADO)', ejemploErrorAlumno),
}

const FILTROS =
  'Filtros opcionales: período (`desde`, `hasta`, extremos incluidos, sin tope de días), `materiaId` y `profesorId`; una materia o un profesor que no existen dan una respuesta vacía.'

export const obtenerCuentaRoute = createRoute({
  method: 'get',
  path: '/alumnos/{alumnoId}',
  tags,
  summary: 'Turnos adeudados y próximos de un alumno',
  description: `Total adeudado, turnos adeudados (anteriores a hoy, sin registrar e impagos) y próximos turnos impagos de hoy a \`limiteCobro\` (hoy + 56 días; no suman a la deuda). ${FILTROS} Con un período, cada sección muestra la parte que le toca: los adeudados nunca incluyen hoy ni después, y los próximos nunca antes de hoy ni después de \`limiteCobro\`. La sección que no aplica al período va \`null\` (\`adeudados\` si el período es sólo futuro, \`proximos\` si es sólo pasado). \`totalAdeudado\` es la suma de los adeudados con todos los filtros. Los importes son el precio por hora vigente de la materia y los calcula la API.`,
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema, query: filtroCuentaQuerySchema },
  responses: {
    200: {
      description: 'Cuenta del alumno',
      content: { 'application/json': { schema: cuentaDelAlumnoSchema, example: ejemploCuenta } },
    },
    400: respuestaError(
      'Id o query inválido, o `hasta` anterior a `desde` (VALIDACION, `details` sobre `hasta`)',
    ),
    ...errores,
  },
})

export const listarAdeudadosRoute = createRoute({
  method: 'get',
  path: '/adeudados',
  tags,
  summary: 'Turnos adeudados de todos los alumnos',
  description: `Vista global paginada de los turnos adeudados, del más antiguo al más reciente, opcionalmente de un alumno. ${FILTROS} Con un período, sólo la parte anterior a hoy; si es sólo futuro (\`desde\` es hoy o posterior), \`aplica\` es \`false\` y la respuesta va vacía y en 0. \`totalAdeudado\` va junto a \`data\` y \`meta\` y es la suma de **todos** los adeudados del filtro, no de la página.`,
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listadoCuentaQuerySchema },
  responses: {
    200: {
      description: 'Página de adeudados con el total del filtro',
      content: {
        'application/json': { schema: adeudadosGlobalSchema, example: ejemploAdeudados },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `page`, `pageSize`, un id, una fecha o `hasta` anterior a `desde` (`details` sobre `hasta`)',
    ),
    ...errores,
  },
})

export const listarProximosRoute = createRoute({
  method: 'get',
  path: '/proximos',
  tags,
  summary: 'Próximos turnos de todos los alumnos',
  description: `Vista global paginada de los próximos turnos (agendados e impagos, de hoy a \`limiteCobro\`), por fecha, hora de inicio y \`turnoId\`, opcionalmente de un alumno. No son deuda: no hay total. ${FILTROS} Con un período, sólo la parte entre hoy y \`limiteCobro\`: si es sólo pasado (\`hasta\` anterior a hoy), \`aplica\` es \`false\` y la respuesta va vacía; si empieza después de \`limiteCobro\`, \`aplica\` es \`true\` y \`data\` va vacío.`,
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listadoCuentaQuerySchema },
  responses: {
    200: {
      description: 'Página de próximos turnos con el tope de cobro',
      content: {
        'application/json': { schema: proximosGlobalSchema, example: ejemploProximos },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `page`, `pageSize`, un id, una fecha o `hasta` anterior a `desde` (`details` sobre `hasta`)',
    ),
    ...errores,
  },
})

export const cuentasRoutes = createRouter()
  .openapi(obtenerCuentaRoute, cuentasController.obtenerCuenta)
  .openapi(listarAdeudadosRoute, cuentasController.listarAdeudados)
  .openapi(listarProximosRoute, cuentasController.listarProximos)
