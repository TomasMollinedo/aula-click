import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as ocurrenciasController from './ocurrencias.controller'
import { ejemploOcurrenciaDetalle, ejemploOcurrenciasDelAlumno } from './ocurrencias.ejemplos'
import {
  ocurrenciaDetalleSchema,
  ocurrenciaParamsSchema,
  ocurrenciasDelAlumnoListadoSchema,
  ocurrenciasDelAlumnoQuerySchema,
} from './ocurrencias.validation'

// Contrato HTTP de `ocurrencias` (T-43): el detalle de un turno en una fecha, y los turnos de un
// alumno, con su pago y las acciones ya calculadas.

const tags = ['Ocurrencias']

function respuestaError(description: string) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema } },
  }
}

export const obtenerOcurrenciaRoute = createRoute({
  method: 'get',
  path: '/{turnoId}/{fecha}',
  tags,
  summary: 'Detalle de una ocurrencia',
  description:
    'La ocurrencia `(turnoId, fecha)` (definición B): alumno, materia, profesor, aula, horario, tipo, serie (con su finalización si la tiene), estado, observaciones, temas, cancelación, pago (pendiente con el importe vigente, o pagado con los datos de su pago), prioridad y el examen que la determina, auditoría y las acciones permitidas (`cancelar`, `finalizar`, `reprogramar`, `registrarPago`). Una ocurrencia agendada y pagada trae `cancelar` visible y deshabilitada, con su `motivo`. `PROFESOR` sólo puede ver el turno si es suyo (si no, 403), con las cuatro acciones no visibles y `pago: null`.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'PROFESOR')] as const,
  request: { params: ocurrenciaParamsSchema },
  responses: {
    200: {
      description: 'Detalle de la ocurrencia',
      content: {
        'application/json': { schema: ocurrenciaDetalleSchema, example: ejemploOcurrenciaDetalle },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es mesa de entradas ni profesor, el turno no es del profesor de la sesión, o el usuario está inhabilitado',
    ),
    404: respuestaError(
      'El turno no existe o esa fecha no es una de sus ocurrencias (NO_ENCONTRADO)',
    ),
  },
})

export const listarOcurrenciasDelAlumnoRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Turnos de un alumno',
  description:
    'Las ocurrencias del alumno en `[desde, hasta]` (pestaña "Turnos" de la ficha, HU-02), incluidas las canceladas: cada una con estado, estado de pago, prioridad y si se puede cancelar. Sin `desde`, 30 días atrás de hoy; sin `hasta`, 8 semanas adelante. El rango no puede exceder esa misma ventana. Sin paginar, ordenadas por fecha y hora.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: ocurrenciasDelAlumnoQuerySchema },
  responses: {
    200: {
      description: 'Ocurrencias del alumno (arreglo vacío si no tiene ninguna)',
      content: {
        'application/json': {
          schema: ocurrenciasDelAlumnoListadoSchema,
          example: ejemploOcurrenciasDelAlumno,
        },
      },
    },
    400: respuestaError(
      '`alumnoId` faltante o inválido, `hasta` anterior a `desde`, o rango fuera de la ventana permitida (VALIDACION)',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
  },
})

export const ocurrenciasRoutes = createRouter()
  .openapi(obtenerOcurrenciaRoute, ocurrenciasController.obtenerOcurrencia)
  .openapi(listarOcurrenciasDelAlumnoRoute, ocurrenciasController.listarOcurrenciasDelAlumno)
