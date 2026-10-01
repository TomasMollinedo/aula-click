import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as finalizacionesController from './finalizaciones.controller'
import {
  ejemploErrorTurnosPagados,
  ejemploErrorYaFinalizado,
  ejemploFinalizada,
  ejemploFinalizar,
  ejemploPrevia,
} from './finalizaciones.ejemplos'
import {
  finalizacionCreadaSchema,
  finalizarTurnoSchema,
  previaFinalizacionQuerySchema,
  previaFinalizacionSchema,
} from './finalizaciones.validation'

// Contrato HTTP de finalizaciones (HU-14, T-47): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-32 y ya está registrado en `app.ts`.

const tags = ['Finalizaciones']

function respuestaError(description: string, examples?: Record<string, unknown>) {
  return {
    description,
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
        ...(examples
          ? {
              examples: Object.fromEntries(
                Object.entries(examples).map(([nombre, value]) => [nombre, { value }]),
              ),
            }
          : {}),
      },
    },
  }
}

const ERROR_400_FECHA =
  '`fechaDesde` anterior a hoy, en otro día de la semana que la serie, no posterior a su inicio o posterior a su fin (en `["fechaDesde"]`)'
const ERROR_409_TURNO =
  'El turno no es recurrente, ya no está vigente o ya fue finalizado (CONFLICTO)'

export const previaFinalizacionRoute = createRoute({
  method: 'get',
  path: '/previa',
  tags,
  summary: 'Previa de la finalización de un turno recurrente',
  description:
    'Qué se libera si el turno (o tramo) se finaliza desde `fechaDesde`: cantidad y rango, los turnos pagados desde esa fecha (que impiden finalizar) y los tramos posteriores del mismo alumno, materia y hora. Aplica las mismas validaciones que `POST /finalizaciones`, salvo los pagados, que acá no son un error.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: previaFinalizacionQuerySchema },
  responses: {
    200: {
      description: 'Lo que se libera',
      content: { 'application/json': { schema: previaFinalizacionSchema, example: ejemploPrevia } },
    },
    400: respuestaError(`Datos inválidos (VALIDACION): formato, o ${ERROR_400_FECHA}`),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El turno no existe (NO_ENCONTRADO)'),
    409: respuestaError(ERROR_409_TURNO, { yaFinalizado: ejemploErrorYaFinalizado }),
  },
})

export const finalizarTurnoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Finalizar un turno recurrente',
  description:
    'Finaliza el turno (o tramo) desde `fechaDesde`: registra una `FinalizacionRecurrencia` y **no modifica** `Turno.fechaFin`. Desde esa fecha la serie deja de aparecer en las agendas y su lugar queda libre; las ocurrencias anteriores no cambian. Si hay turnos pagados desde `fechaDesde`, no se finaliza.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: finalizarTurnoSchema, example: ejemploFinalizar } },
    },
  },
  responses: {
    201: {
      description: 'Turno finalizado',
      content: {
        'application/json': { schema: finalizacionCreadaSchema, example: ejemploFinalizada },
      },
    },
    400: respuestaError(
      `Datos inválidos (VALIDACION): formato, \`detalle\` de más de 500 caracteres u obligatorio con \`motivo = OTRO\`, o ${ERROR_400_FECHA}`,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El turno no existe (NO_ENCONTRADO)'),
    409: respuestaError(
      `${ERROR_409_TURNO}, o hay turnos pagados desde \`fechaDesde\` (TURNOS_PAGADOS): \`details\` con \`ultimaFechaPagada\`, \`fechaDesdeMinima\` (\`null\` si los pagados llegan hasta el final de la serie) y \`pagadas\``,
      { turnosPagados: ejemploErrorTurnosPagados, yaFinalizado: ejemploErrorYaFinalizado },
    ),
  },
})

export const finalizacionesRoutes = createRouter()
  .openapi(previaFinalizacionRoute, finalizacionesController.previa)
  .openapi(finalizarTurnoRoute, finalizacionesController.finalizar)
