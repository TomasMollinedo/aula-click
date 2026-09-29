import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as agendasController from './agendas.controller'
import {
  ejemploAgendaDiaria,
  ejemploAgendaPropia,
  ejemploAulasConTurno,
  ejemploMateriasConTurno,
} from './agendas.ejemplos'
import {
  agendaListadoSchema,
  agendaProfesorQuerySchema,
  agendaPropiaListadoSchema,
  agendaPropiaQuerySchema,
  agendaQuerySchema,
  aulasConTurnoListadoSchema,
  aulasConTurnoQuerySchema,
  materiasConTurnoListadoSchema,
  materiasConTurnoQuerySchema,
} from './agendas.validation'

// Contrato HTTP de las agendas (salieron de `turnos` en T-30, con el mismo contrato salvo la URL):
// cada endpoint se declara con createRoute() y se registra acá. T-57 las extiende.

const tags = ['Agendas']

function respuestaError(description: string) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema } },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

export const listarAgendaRoute = createRoute({
  method: 'get',
  path: '/diaria',
  tags,
  summary: 'Agenda diaria del centro',
  description:
    'Turnos ACTIVO de una fecha (por defecto hoy), con alumno, profesor, materia y aula, sin las ocurrencias canceladas. Paginada (decisión T-35); filtrable por materia, aula, profesor (vista personal de su agenda, decisión T-42) y `q` (búsqueda por nombre de alumno o profesor, o sólo de alumno con `profesorId`, decisión T-36). Ordenada por hora y, dentro de la hora, por profesor.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: agendaQuerySchema },
  responses: {
    200: {
      description: 'Página de la agenda (arreglo vacío si no hay turnos ese día)',
      content: {
        'application/json': { schema: agendaListadoSchema, example: ejemploAgendaDiaria },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    ...errores,
  },
})

export const listarAgendaPropiaRoute = createRoute({
  method: 'get',
  path: '/propia',
  tags,
  summary: 'Agenda propia del profesor',
  description:
    'Turnos del profesor **de la sesión** (sale del `Actor`, nunca de un parámetro) para un día o un rango: una entrada por cada ocurrencia no cancelada, con alumno, materia, aula, horario y estado. Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. El rango no puede superar los 31 días. Sin paginar (decisión T-43), ordenada por fecha y, dentro del día, por hora. Sólo lectura.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { query: agendaPropiaQuerySchema },
  responses: {
    200: {
      description: 'Ocurrencias del rango (arreglo vacío si no hay turnos)',
      content: {
        'application/json': { schema: agendaPropiaListadoSchema, example: ejemploAgendaPropia },
      },
    },
    400: respuestaError('Query inválido, `hasta` anterior a `desde` o rango mayor al máximo'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es profesor (SIN_PERMISO) o el usuario está inhabilitado (USUARIO_INHABILITADO)',
    ),
    404: respuestaError('El usuario de la sesión no tiene ficha de profesor (NO_ENCONTRADO)'),
  },
})

// La respuesta es `agendaPropiaListadoSchema` (componente `AgendaPropiaItem`) aunque el profesor
// no sea el de la sesión: misma forma y misma lógica que `/propia` (decisión T-44).
export const listarAgendaProfesorRoute = createRoute({
  method: 'get',
  path: '/profesor',
  tags,
  summary: 'Agenda de un profesor',
  description:
    'Turnos del profesor `profesorId` para un día o un rango, para la ficha del profesor (HU-02): misma forma que `/agendas/propia` (una entrada por ocurrencia no cancelada, sin datos del profesor). Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. El rango no puede superar los 31 días. Sin paginar (decisiones T-43 y T-44), ordenada por fecha y, dentro del día, por hora. Un profesor inactivo también se puede consultar. Sólo lectura.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: agendaProfesorQuerySchema },
  responses: {
    200: {
      description: 'Ocurrencias del rango (arreglo vacío si no hay turnos)',
      content: {
        'application/json': { schema: agendaPropiaListadoSchema, example: ejemploAgendaPropia },
      },
    },
    400: respuestaError(
      '`profesorId` faltante o inválido, query inválido, `hasta` anterior a `desde` o rango mayor al máximo (VALIDACION)',
    ),
    ...errores,
    404: respuestaError('El profesor no existe (NO_ENCONTRADO)'),
  },
})

export const listarMateriasConTurnoRoute = createRoute({
  method: 'get',
  path: '/materias',
  tags,
  summary: 'Materias con turno en una fecha',
  description:
    'Selector para el filtro de materia de la agenda: materias con al menos una ocurrencia no cancelada en la fecha pedida (id y nombre, sin paginar). Sin `fecha`, la de hoy, igual que la agenda.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: materiasConTurnoQuerySchema },
  responses: {
    200: {
      description: 'Materias con turno ese día (arreglo vacío si no hay ninguna)',
      content: {
        'application/json': {
          schema: materiasConTurnoListadoSchema,
          example: ejemploMateriasConTurno,
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
    'Selector para el filtro de aula de la agenda: aulas con al menos una ocurrencia no cancelada en la fecha pedida (id y nombre, sin paginar). Sin `fecha`, la de hoy, igual que la agenda.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: aulasConTurnoQuerySchema },
  responses: {
    200: {
      description: 'Aulas con turno ese día (arreglo vacío si no hay ninguna)',
      content: {
        'application/json': { schema: aulasConTurnoListadoSchema, example: ejemploAulasConTurno },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    ...errores,
  },
})

export const agendasRoutes = createRouter()
  .openapi(listarAgendaRoute, agendasController.listarAgenda)
  .openapi(listarAgendaPropiaRoute, agendasController.listarAgendaPropia)
  .openapi(listarAgendaProfesorRoute, agendasController.listarAgendaDeProfesor)
  .openapi(listarMateriasConTurnoRoute, agendasController.listarMateriasConTurno)
  .openapi(listarAulasConTurnoRoute, agendasController.listarAulasConTurno)
