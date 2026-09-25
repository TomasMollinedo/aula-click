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
  agendaListadoSchema,
  agendaQuerySchema,
  aulasConTurnoListadoSchema,
  aulasConTurnoQuerySchema,
  crearTurnoSchema,
  disponibilidadQuerySchema,
  disponibilidadSchema,
  materiasConTurnoListadoSchema,
  materiasConTurnoQuerySchema,
  turnoDetalleSchema,
  turnoIdParamsSchema,
  turnosAltaSchema,
} from './turnos.validation'

// Contrato HTTP de turnos: cada endpoint se declara con createRoute() y se registra acá.
// `/{turnoId}` se registra al final: si no, capturaría `/agenda`, `/materias`, `/aulas` y
// `/disponibilidad` (y respondería 400, porque el id tiene que ser un entero).

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

export const listarAgendaRoute = createRoute({
  method: 'get',
  path: '/agenda',
  tags,
  summary: 'Agenda diaria del centro',
  description:
    'Turnos ACTIVO de una fecha (por defecto hoy), con alumno, profesor, materia y aula. Paginada (decisión T-35); filtrable por materia, aula y `q` (búsqueda por nombre de alumno o profesor, decisión T-36). Ordenada por hora y, dentro de la hora, por profesor.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: agendaQuerySchema },
  responses: {
    200: {
      description: 'Página de la agenda (arreglo vacío si no hay turnos ese día)',
      content: {
        'application/json': {
          schema: agendaListadoSchema,
          example: {
            data: [
              {
                id: 15,
                alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
                profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
                materia: { id: 2, nombre: 'Matemática' },
                aula: { id: 1, nombre: 'Aula 1' },
                horaInicio: '09:00',
                horaFin: '10:00',
                estado: 'ACTIVO',
              },
            ],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    ...errores,
  },
})

export const listarMateriasConTurnoRoute = createRoute({
  method: 'get',
  path: '/materias',
  tags,
  summary: 'Materias con turno en una fecha',
  description:
    'Selector para el filtro de materia de la agenda: materias con al menos un turno ACTIVO en la fecha pedida (id y nombre, sin paginar). Sin `fecha`, la de hoy, igual que la agenda.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: materiasConTurnoQuerySchema },
  responses: {
    200: {
      description: 'Materias con turno ese día (arreglo vacío si no hay ninguna)',
      content: {
        'application/json': {
          schema: materiasConTurnoListadoSchema,
          example: [
            { id: 2, nombre: 'Matemática' },
            { id: 7, nombre: 'Física' },
          ],
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    ...errores,
  },
})

export const listarAulasConTurnoRoute = createRoute({
  method: 'get',
  path: '/aulas',
  tags,
  summary: 'Aulas con turno en una fecha',
  description:
    'Selector para el filtro de aula de la agenda: aulas con al menos un turno ACTIVO en la fecha pedida (id y nombre, sin paginar). Sin `fecha`, la de hoy, igual que la agenda.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: aulasConTurnoQuerySchema },
  responses: {
    200: {
      description: 'Aulas con turno ese día (arreglo vacío si no hay ninguna)',
      content: {
        'application/json': {
          schema: aulasConTurnoListadoSchema,
          example: [
            { id: 1, nombre: 'Aula 1' },
            { id: 2, nombre: 'Aula 2' },
          ],
        },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    ...errores,
  },
})

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
  .openapi(listarAgendaRoute, turnosController.listarAgenda)
  .openapi(listarMateriasConTurnoRoute, turnosController.listarMateriasConTurno)
  .openapi(listarAulasConTurnoRoute, turnosController.listarAulasConTurno)
  .openapi(disponibilidadRoute, turnosController.disponibilidad)
  .openapi(crearTurnoRoute, turnosController.crear)
  .openapi(obtenerTurnoRoute, turnosController.obtener)
