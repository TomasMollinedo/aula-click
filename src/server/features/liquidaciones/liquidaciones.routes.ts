import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as liquidacionesController from './liquidaciones.controller'
import {
  ejemploErrorMesFuturo,
  ejemploErrorProfesorNoEncontrado,
  ejemploLiquidacionDetalle,
  ejemploLiquidacionesDelMes,
} from './liquidaciones.ejemplos'
import {
  liquidacionDetalleSchema,
  liquidacionesDelMesSchema,
  liquidacionesQuerySchema,
  liquidacionParamsSchema,
} from './liquidaciones.validation'

// Contrato HTTP de liquidaciones (pago a profesores, HU-44): cada endpoint se declara con
// createRoute() y se registra acá. Las rutas del gerente cuelgan de `/` y de
// `/profesores/{profesorId}/{mes}` (T-124; T-125 suma `…/pdf`); las del profesor, de los segmentos
// fijos `/mis-ingresos` y `/mis-liquidaciones` (T-126), que no chocan con éstas.

const tags = ['Liquidaciones']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const listarLiquidacionesRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Liquidaciones del mes',
  description:
    'Una fila por profesor con turnos o ajustes en el mes, aunque esté inactivo, por apellido y nombre: cerrada (con sus importes congelados) o calculada. `mes` por defecto: el último mes terminado; el mes en curso se puede pedir (sus filas salen `EN_CURSO`). `totales` suma todo el listado, no la página.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: liquidacionesQuerySchema },
  responses: {
    200: {
      description: 'Liquidaciones del mes',
      content: {
        'application/json': {
          schema: liquidacionesDelMesSchema,
          example: ejemploLiquidacionesDelMes,
        },
      },
    },
    400: respuestaError(
      '`mes` con formato inválido o futuro, o paginación inválida (VALIDACION)',
      ejemploErrorMesFuturo,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es gerente o el usuario está inhabilitado'),
  },
})

export const detalleLiquidacionRoute = createRoute({
  method: 'get',
  path: '/profesores/{profesorId}/{mes}',
  tags,
  summary: 'Liquidación de un profesor en un mes',
  description:
    'Turnos, ajustes y totales de la liquidación, con el mismo cálculo del listado. Si está cerrada, los datos de la transferencia, el comprobante adjunto (sin URL: se pide a `GET /adjuntos/liquidaciones/{liquidacionId}`) y quién registró el pago. Sin movimientos en el mes: la liquidación vacía (`estado: null`). `acciones.registrarPago` sólo en `PENDIENTE_DE_PAGO`.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { params: liquidacionParamsSchema },
  responses: {
    200: {
      description: 'La liquidación',
      content: {
        'application/json': {
          schema: liquidacionDetalleSchema,
          example: ejemploLiquidacionDetalle,
        },
      },
    },
    400: respuestaError(
      '`profesorId` no es un entero positivo, o `mes` con formato inválido o futuro (VALIDACION)',
      ejemploErrorMesFuturo,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es gerente o el usuario está inhabilitado'),
    404: respuestaError('Profesor no encontrado', ejemploErrorProfesorNoEncontrado),
  },
})

export const liquidacionesRoutes = createRouter()
  .openapi(listarLiquidacionesRoute, liquidacionesController.listarLiquidaciones)
  .openapi(detalleLiquidacionRoute, liquidacionesController.detalleLiquidacion)
