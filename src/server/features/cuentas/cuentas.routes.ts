import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as cuentasController from './cuentas.controller'
import { ejemploAdeudados, ejemploCuenta, ejemploErrorAlumno } from './cuentas.ejemplos'
import {
  adeudadosGlobalSchema,
  adeudadosQuerySchema,
  alumnoIdParamsSchema,
  cuentaDelAlumnoSchema,
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

export const obtenerCuentaRoute = createRoute({
  method: 'get',
  path: '/alumnos/{alumnoId}',
  tags,
  summary: 'Pagos y deuda de un alumno',
  description:
    'Total adeudado, pagado del mes (por fecha de pago), turnos adeudados (anteriores a hoy, sin registrar e impagos), próximos turnos impagos de hoy a hoy + 56 días (no suman a la deuda) e historial de pagos. Los importes son el precio por hora vigente de la materia y los calcula la API.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    200: {
      description: 'Cuenta del alumno',
      content: { 'application/json': { schema: cuentaDelAlumnoSchema, example: ejemploCuenta } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    ...errores,
  },
})

export const listarAdeudadosRoute = createRoute({
  method: 'get',
  path: '/adeudados',
  tags,
  summary: 'Turnos adeudados de todos los alumnos',
  description:
    'Vista global paginada de los turnos adeudados, del más antiguo al más reciente, opcionalmente de un alumno. `totalAdeudado` va junto a `data` y `meta` y es la suma de **todos** los adeudados del filtro, no de la página.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: adeudadosQuerySchema },
  responses: {
    200: {
      description: 'Página de adeudados con el total del filtro',
      content: {
        'application/json': { schema: adeudadosGlobalSchema, example: ejemploAdeudados },
      },
    },
    400: respuestaError('Query inválido (VALIDACION): `page`, `pageSize` o `alumnoId`'),
    ...errores,
  },
})

export const cuentasRoutes = createRouter()
  .openapi(obtenerCuentaRoute, cuentasController.obtenerCuenta)
  .openapi(listarAdeudadosRoute, cuentasController.listarAdeudados)
