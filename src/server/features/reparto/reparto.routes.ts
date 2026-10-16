import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import { paginacionQuerySchema } from '@/server/shared/paginacion'
import * as repartoController from './reparto.controller'
import {
  ejemploCambiarPorcentaje,
  ejemploErrorMismoPorcentaje,
  ejemploErrorPorcentajeInvalido,
  ejemploPorcentaje,
  ejemploPorcentajeConHistorial,
} from './reparto.ejemplos'
import {
  cambiarPorcentajeSchema,
  porcentajeCentroConHistorialSchema,
  porcentajeCentroSchema,
} from './reparto.validation'

// Contrato HTTP de reparto (porcentaje del centro, HU-43, T-120): cada endpoint se declara con
// createRoute() y se registra acá. El router lo creó T-119 y ya está registrado en `app.ts`.

const tags = ['Reparto']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const leerPorcentajeRoute = createRoute({
  method: 'get',
  path: '/porcentaje',
  tags,
  summary: 'Porcentaje del centro vigente y su historial',
  description:
    'El porcentaje que el centro retiene de cada turno cobrado (el último registrado), desde cuándo rige y quién lo cambió, y el historial paginado de cambios, del más reciente al más antiguo (el vigente es la primera fila de la página 1). Sin ningún porcentaje configurado responde 500 `ERROR_INTERNO` (error de configuración, decisión T-161).',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: paginacionQuerySchema },
  responses: {
    200: {
      description: 'Vigente e historial',
      content: {
        'application/json': {
          schema: porcentajeCentroConHistorialSchema,
          example: ejemploPorcentajeConHistorial,
        },
      },
    },
    400: respuestaError('`page` o `pageSize` inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es gerente o el usuario está inhabilitado'),
  },
})

export const cambiarPorcentajeRoute = createRoute({
  method: 'put',
  path: '/porcentaje',
  tags,
  summary: 'Cambiar el porcentaje del centro',
  description:
    'Registra un porcentaje nuevo, que rige para los cobros que se registren desde ahora: los cobros anteriores conservan el suyo. Agrega una fila al historial y no modifica nada más. Responde el nuevo vigente. Sin ningún porcentaje configurado responde 500 `ERROR_INTERNO`.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: cambiarPorcentajeSchema, example: ejemploCambiarPorcentaje },
      },
    },
  },
  responses: {
    200: {
      description: 'El nuevo porcentaje vigente',
      content: {
        'application/json': { schema: porcentajeCentroSchema, example: ejemploPorcentaje },
      },
    },
    400: {
      description:
        'Porcentaje fuera de [0, 100), con más de dos decimales o que no es un número; o igual al vigente (VALIDACION)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            invalido: { value: ejemploErrorPorcentajeInvalido },
            igualAlVigente: { value: ejemploErrorMismoPorcentaje },
          },
        },
      },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es gerente o el usuario está inhabilitado'),
  },
})

export const repartoRoutes = createRouter()
  .openapi(leerPorcentajeRoute, repartoController.leerPorcentaje)
  .openapi(cambiarPorcentajeRoute, repartoController.cambiarPorcentaje)
