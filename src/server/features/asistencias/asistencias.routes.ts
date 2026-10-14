import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as asistenciasController from './asistencias.controller'
import {
  ejemploDelDia,
  ejemploErrorCancelado,
  ejemploErrorFueraDePlazo,
  ejemploPendientes,
  ejemploRegistradas,
  ejemploRegistrar,
} from './asistencias.ejemplos'
import {
  asistenciasDelDiaSchema,
  asistenciasPendientesSchema,
  asistenciasQuerySchema,
  asistenciasRegistradasSchema,
  registrarAsistenciasSchema,
} from './asistencias.validation'

// Contrato HTTP de asistencias (HU-22, T-81): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-73 y ya está registrado en `app.ts`. Sólo el profesor:
// mesa de entradas y gerente reciben 403.

const tags = ['Asistencias']

function respuestaError(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponseSchema } } }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es profesor o el usuario está inhabilitado (SIN_PERMISO)'),
  404: respuestaError('El usuario no tiene ficha de profesor (NO_ENCONTRADO)'),
}

export const asistenciasDelDiaRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Clases del profesor en un día, para registrar la asistencia',
  description:
    'Las clases del profesor de la sesión en `fecha` (sin ella, hoy): cada hora de un bloque con al menos un turno no cancelado, en orden horario, con sus filas. Cada fila es un grupo de horas seguidas de un alumno y va en la clase de su primera hora. Los turnos cancelados no aparecen. Cualquier día pasado se puede pedir: con el plazo vencido, `editable` es `false` (sólo lectura).',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { query: asistenciasQuerySchema },
  responses: {
    200: {
      description: 'Clases del día',
      content: { 'application/json': { schema: asistenciasDelDiaSchema, example: ejemploDelDia } },
    },
    400: respuestaError('`fecha` inválida o posterior a hoy (VALIDACION)'),
    ...errores,
  },
})

export const asistenciasPendientesRoute = createRoute({
  method: 'get',
  path: '/pendientes',
  tags,
  summary: 'Turnos de días anteriores sin registrar y todavía en plazo',
  description:
    'Turnos del profesor de la sesión de días anteriores a hoy, sin asistencia y con el plazo sin vencer: cuántos son y el más antiguo, con la fecha hasta la que se puede registrar.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  responses: {
    200: {
      description: 'Pendientes',
      content: {
        'application/json': { schema: asistenciasPendientesSchema, example: ejemploPendientes },
      },
    },
    ...errores,
  },
})

export const registrarAsistenciasRoute = createRoute({
  method: 'put',
  path: '/',
  tags,
  summary: 'Registrar o corregir asistencias',
  description:
    'Todo o nada. Cada registro es una fila: una o varias horas seguidas del mismo alumno, materia y fecha, con el mismo estado y los mismos textos en cada hora. `PRESENTE` acepta `trabajado` e `indicaciones` (hasta 1000 caracteres); `AUSENTE`, `observacion` (hasta 500). Corregir es volver a mandar la misma ocurrencia: actualiza quién y cuándo la modificó. Cada ocurrencia tiene que ser del profesor de la sesión, no estar cancelada, ser de hoy o anterior y estar dentro del plazo (7 días). Responde las filas registradas con la forma del `GET`.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: registrarAsistenciasSchema, example: ejemploRegistrar },
      },
    },
  },
  responses: {
    200: {
      description: 'Asistencias registradas',
      content: {
        'application/json': { schema: asistenciasRegistradasSchema, example: ejemploRegistradas },
      },
    },
    400: respuestaError(
      'Datos inválidos, fecha futura, ocurrencia repetida, texto que no corresponde al estado u horas que no son seguidas (VALIDACION)',
    ),
    401: errores[401],
    403: respuestaError(
      'El rol no es profesor, el usuario está inhabilitado o alguna ocurrencia no existe o no es del profesor (SIN_PERMISO)',
    ),
    404: errores[404],
    409: {
      description:
        'Alguna ocurrencia está cancelada (TURNO_CANCELADO) o tiene el plazo vencido (FUERA_DE_PLAZO)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            cancelado: { summary: 'Turno cancelado', value: ejemploErrorCancelado },
            fueraDePlazo: { summary: 'Fuera de plazo', value: ejemploErrorFueraDePlazo },
          },
        },
      },
    },
  },
})

export const asistenciasRoutes = createRouter()
  .openapi(asistenciasDelDiaRoute, asistenciasController.delDia)
  .openapi(asistenciasPendientesRoute, asistenciasController.pendientes)
  .openapi(registrarAsistenciasRoute, asistenciasController.registrar)
