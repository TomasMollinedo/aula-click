import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as turnosController from './turnos.controller'
import {
  ejemploAltaEnTramos,
  ejemploAltaRecurrente,
  ejemploAltaSesionUnica,
  ejemploDetalle,
  ejemploDisponibilidad,
  ejemploErrorAlumnoSuperpuesto,
  ejemploErrorBloqueLleno,
  ejemploErrorFechaFueraDelDia,
} from './turnos.ejemplos'
import {
  crearTurnoSchema,
  disponibilidadQuerySchema,
  disponibilidadSchema,
  turnoDetalleSchema,
  turnoIdParamsSchema,
  turnosAltaSchema,
} from './turnos.validation'

// Contrato HTTP de turnos: cada endpoint se declara con createRoute() y se registra acá.
// `/disponibilidad` se registra antes que `/{turnoId}`.

const tags = ['Turnos']

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
}

export const disponibilidadRoute = createRoute({
  method: 'get',
  path: '/disponibilidad',
  tags,
  summary: 'Horas disponibles para un turno',
  description:
    'Filas activas de los profesores activos que dictan la materia, agrupadas como bloques (mismo profesor, día y aula, horas contiguas), cada hora con su capacidad efectiva y su ocupación en `fecha` (la pedida o la próxima ocurrencia de ese día, hoy incluido). Las horas llenas vienen igual, con `lleno: true`. Sin paginar; `[]` si no hay opciones (también si `profesorId` no dicta la materia). Orden: profesor (apellido y nombre), día y hora.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: disponibilidadQuerySchema },
  responses: {
    200: {
      description: 'Bloques con sus horas',
      content: {
        'application/json': { schema: disponibilidadSchema, example: ejemploDisponibilidad },
      },
    },
    400: respuestaError(
      'Query inválido, `fecha` anterior a hoy o que no cae en `diaSemana` (VALIDACION)',
    ),
    ...errores,
    404: respuestaError('La materia no existe (NO_ENCONTRADO)'),
    409: respuestaError('La materia está inactiva (MATERIA_INACTIVA, sin details)', {
      error: {
        code: 'MATERIA_INACTIVA',
        message: 'La materia está inactiva: no se le pueden asignar turnos',
      },
    }),
  },
})

export const crearTurnoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Registrar un turno',
  description:
    'Un turno por cada hora elegida (filas del mismo profesor y día), todo o nada. `RECURRENTE` va de `fechaInicio` a `fechaFin` (o sin fin, `null`); `SESION_UNICA`, una fecha. Si un recurrente tiene fechas sin lugar, responde 409 `BLOQUE_LLENO` con las fechas por hora; reenviado con `asignarDondeHayLugar: true`, se crea solo en las fechas con lugar, como varios turnos (tramos), y `fechasSinTurno` informa las salteadas. Sin lugar en ninguna fecha (o una sesión única llena) y `ALUMNO_SUPERPUESTO` se rechazan siempre.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearTurnoSchema,
          examples: {
            recurrente: { summary: 'Recurrente con fin', value: ejemploAltaRecurrente },
            sesionUnica: { summary: 'Sesión única, dos horas', value: ejemploAltaSesionUnica },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Turnos creados (uno por hora y tramo) y fechas sin turno',
      content: { 'application/json': { schema: turnosAltaSchema, example: ejemploAltaEnTramos } },
    },
    400: respuestaError(
      'Datos inválidos, fecha pasada, fechas que no caen en el día de las horas, u horas de más de un profesor o día (VALIDACION)',
      ejemploErrorFechaFueraDelDia,
    ),
    ...errores,
    404: respuestaError(
      'El alumno o la materia no existen, o alguna hora no existe o está dada de baja (NO_ENCONTRADO; por posición en `bloqueIds`)',
    ),
    409: {
      description:
        'Hora sin lugar (BLOQUE_LLENO), alumno con un turno en ese horario (ALUMNO_SUPERPUESTO), profesor inactivo (PROFESOR_INACTIVO), materia inactiva (MATERIA_INACTIVA) o no asignada al profesor (MATERIA_NO_ASIGNADA)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            bloqueLleno: { summary: 'Fechas sin lugar', value: ejemploErrorBloqueLleno },
            alumnoSuperpuesto: {
              summary: 'Alumno superpuesto',
              value: ejemploErrorAlumnoSuperpuesto,
            },
          },
        },
      },
    },
  },
})

export const obtenerTurnoRoute = createRoute({
  method: 'get',
  path: '/{turnoId}',
  tags,
  summary: 'Detalle de un turno',
  description:
    'Alumno, profesor, materia, aula, día, horario, fechas, motivo, estado (`ACTIVO` se muestra como "Agendado") y la auditoría. Un recurrente creado con huecos son varios turnos: cada uno tiene su detalle.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: turnoIdParamsSchema },
  responses: {
    200: {
      description: 'Detalle del turno',
      content: { 'application/json': { schema: turnoDetalleSchema, example: ejemploDetalle } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    ...errores,
    404: respuestaError('El turno no existe (NO_ENCONTRADO)'),
  },
})

export const turnosRoutes = createRouter()
  .openapi(disponibilidadRoute, turnosController.disponibilidad)
  .openapi(crearTurnoRoute, turnosController.crear)
  .openapi(obtenerTurnoRoute, turnosController.obtener)
