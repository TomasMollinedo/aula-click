import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as reprogramacionesController from './reprogramaciones.controller'
import {
  ejemploErrorBloqueLleno,
  ejemploReprogramado,
  ejemploReprogramar,
} from './reprogramaciones.ejemplos'
import { reprogramadoSchema, reprogramarSchema } from './reprogramaciones.validation'

// Contrato HTTP de reprogramaciones (HU-20, T-49): cada endpoint se declara con createRoute() y se
// registra acá. El router lo creó T-32 y ya está registrado en `app.ts`. La búsqueda de horarios
// reutiliza `GET /turnos/disponibilidad` con `fecha`: no hay endpoint nuevo.

const tags = ['Reprogramaciones']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

export const reprogramarRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Reprogramar una ocurrencia de un turno',
  description:
    'Mueve la ocurrencia `(turnoId, fecha)` (`AGENDADO`, de hoy o posterior; una pagada se puede) a otra fecha, hora o profesor. Edita el turno, sin tabla de reprogramaciones: una sesión única cambia de hora y fecha; en un recurrente sólo se mueve esa fecha y la serie se parte en el turno original, un tramo nuevo con el resto y una `SESION_UNICA` nueva en el destino (sin turnos vacíos). El pago acompaña a la ocurrencia y las cancelaciones y pagos de las fechas que cambian de turno se re-apuntan. Todo o nada.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: reprogramarSchema, example: ejemploReprogramar } },
    },
  },
  responses: {
    200: {
      description: 'Ocurrencia reprogramada',
      content: {
        'application/json': { schema: reprogramadoSchema, example: ejemploReprogramado },
      },
    },
    400: respuestaError(
      'Datos inválidos (VALIDACION): formato, `fechaDestino` anterior a hoy o fuera del día de la hora de destino, o el mismo lugar que el de origen',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
    404: respuestaError('El turno, la ocurrencia en esa fecha o la hora de destino no existen'),
    409: respuestaError(
      'La ocurrencia está cancelada o ya pasó; o el destino no sirve: profesor inactivo (PROFESOR_INACTIVO), materia inactiva (MATERIA_INACTIVA) o no asignada (MATERIA_NO_ASIGNADA), hora completa (BLOQUE_LLENO) o alumno con otro turno en ese horario (ALUMNO_SUPERPUESTO)',
      ejemploErrorBloqueLleno,
    ),
  },
})

export const reprogramacionesRoutes = createRouter().openapi(
  reprogramarRoute,
  reprogramacionesController.reprogramar,
)
