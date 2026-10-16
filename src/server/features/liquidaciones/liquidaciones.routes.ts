import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as liquidacionesController from './liquidaciones.controller'
import {
  ejemploErrorFechaTransferencia,
  ejemploErrorMesFuturo,
  ejemploErrorMesNoTerminado,
  ejemploErrorLiquidacionModificada,
  ejemploErrorLiquidacionPagada,
  ejemploErrorSinImporte,
  ejemploErrorProfesorNoEncontrado,
  ejemploLiquidacionDetalle,
  ejemploLiquidacionesDelMes,
  ejemploLiquidacionPagada,
  ejemploMiLiquidacion,
  ejemploMisIngresos,
  ejemploMisLiquidaciones,
  ejemploPagarLiquidacion,
} from './liquidaciones.ejemplos'
import {
  liquidacionDetalleSchema,
  liquidacionPagadaSchema,
  liquidacionesDelMesSchema,
  liquidacionesQuerySchema,
  liquidacionParamsSchema,
  miLiquidacionParamsSchema,
  miLiquidacionSchema,
  misIngresosSchema,
  misLiquidacionesQuerySchema,
  misLiquidacionesSchema,
  pagarLiquidacionSchema,
} from './liquidaciones.validation'

// Contrato HTTP de liquidaciones (pago a profesores, HU-44): cada endpoint se declara con
// createRoute() y se registra acá. Las rutas del gerente cuelgan de `/` y de
// `/profesores/{profesorId}/{mes}` (T-124: el detalle y `…/pago`; T-125 suma `…/pdf`); las del profesor, de los segmentos
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

export const pagarLiquidacionRoute = createRoute({
  method: 'post',
  path: '/profesores/{profesorId}/{mes}/pago',
  tags,
  summary: 'Registrar el pago de una liquidación',
  description:
    'Registra la transferencia de una liquidación `PENDIENTE_DE_PAGO` por su total calculado (sin pagos parciales: el monto no se manda; `totalConfirmado` es el total que mostró el detalle, como control). En una transacción la cierra `PAGADA` con sus turnos y ajustes congelados, cierra como `DESCONTADA` las de saldo negativo que absorbió y vincula el comprobante (subido antes con `POST /adjuntos`). Errores, en orden: 400; 404; 409 `CONFLICTO` si el mes no terminó; 400 de `fechaTransferencia`; 409 `LIQUIDACION_PAGADA` ("La liquidación de octubre de 2026 de Gómez, Ana ya está pagada"), 409 `CONFLICTO` ("No hay importe a pagar") y 409 `LIQUIDACION_MODIFICADA` ("La liquidación cambió desde que la abriste. Revisala antes de pagar": el total cambió o otro pago ganó la carrera).',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: {
    params: liquidacionParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: pagarLiquidacionSchema, example: ejemploPagarLiquidacion },
      },
    },
  },
  responses: {
    201: {
      description: 'Pago registrado',
      content: {
        'application/json': { schema: liquidacionPagadaSchema, example: ejemploLiquidacionPagada },
      },
    },
    400: {
      description:
        'Body o parámetros inválidos, `fechaTransferencia` futura o anterior al último día del mes (VALIDACION), o comprobante inválido (ADJUNTO_INVALIDO)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: { fechaTransferencia: { value: ejemploErrorFechaTransferencia } },
        },
      },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es gerente o el usuario está inhabilitado'),
    404: respuestaError('Profesor no encontrado', ejemploErrorProfesorNoEncontrado),
    409: {
      description:
        'El mes no terminó o no hay importe a pagar (CONFLICTO), ya está pagada (LIQUIDACION_PAGADA) o cambió desde que se abrió (LIQUIDACION_MODIFICADA)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            mesNoTerminado: { value: ejemploErrorMesNoTerminado },
            sinImporte: { value: ejemploErrorSinImporte },
            pagada: { value: ejemploErrorLiquidacionPagada },
            modificada: { value: ejemploErrorLiquidacionModificada },
          },
        },
      },
    },
  },
})

// ---------- "Mis ingresos" del profesor (HU-45, T-126) ----------

const ERROR_403_PROFESOR =
  'El rol no es profesor, el usuario no tiene ficha de profesor o está inhabilitado (SIN_PERMISO)'

export const misIngresosRoute = createRoute({
  method: 'get',
  path: '/mis-ingresos',
  tags,
  summary: 'Mis ingresos (profesor)',
  description:
    'Del profesor de la sesión (no recibe un `profesorId`): `esteMes`, la liquidación del mes en curso con el mismo cálculo que ve el gerente (sin el número de comprobante de las familias); `clasesSinCobrar`, las clases con asistencia (presente o ausente) y sin pago vigente de los últimos 366 días; y `clasesCobradasSinAsistencia`, las de hoy o anteriores con pago vigente, sin asistencia y dentro del plazo, con su `vence`. Las dos listas, de la más reciente a la más antigua. Nada de otros profesores ni del centro.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  responses: {
    200: {
      description: 'Mis ingresos',
      content: { 'application/json': { schema: misIngresosSchema, example: ejemploMisIngresos } },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(ERROR_403_PROFESOR),
  },
})

export const misLiquidacionesRoute = createRoute({
  method: 'get',
  path: '/mis-liquidaciones',
  tags,
  summary: 'Mis liquidaciones (profesor)',
  description:
    'Del profesor de la sesión: una fila por mes con movimientos, sin el mes en curso (está en `GET /liquidaciones/mis-ingresos`), del más reciente al más antiguo: mes, estado, total y la fecha de la transferencia si está pagada.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { query: misLiquidacionesQuerySchema },
  responses: {
    200: {
      description: 'Mis liquidaciones',
      content: {
        'application/json': { schema: misLiquidacionesSchema, example: ejemploMisLiquidaciones },
      },
    },
    400: respuestaError('Paginación inválida (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(ERROR_403_PROFESOR),
  },
})

export const miLiquidacionRoute = createRoute({
  method: 'get',
  path: '/mis-liquidaciones/{mes}',
  tags,
  summary: 'Mi liquidación de un mes (profesor)',
  description:
    'La liquidación del profesor de la sesión en `mes`, con el formato del detalle del gerente sin el comprobante adjunto, quién registró el pago, las observaciones, las acciones ni el número de comprobante de las familias. Cualquier mes no futuro (también el en curso). Sin movimientos: la liquidación vacía (`estado: null`).',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { params: miLiquidacionParamsSchema },
  responses: {
    200: {
      description: 'La liquidación',
      content: {
        'application/json': { schema: miLiquidacionSchema, example: ejemploMiLiquidacion },
      },
    },
    400: respuestaError('`mes` con formato inválido o futuro (VALIDACION)', ejemploErrorMesFuturo),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(ERROR_403_PROFESOR),
  },
})

export const liquidacionesRoutes = createRouter()
  .openapi(listarLiquidacionesRoute, liquidacionesController.listarLiquidaciones)
  .openapi(misIngresosRoute, liquidacionesController.misIngresos)
  .openapi(misLiquidacionesRoute, liquidacionesController.misLiquidaciones)
  .openapi(miLiquidacionRoute, liquidacionesController.miLiquidacion)
  .openapi(detalleLiquidacionRoute, liquidacionesController.detalleLiquidacion)
  .openapi(pagarLiquidacionRoute, liquidacionesController.pagarLiquidacion)
