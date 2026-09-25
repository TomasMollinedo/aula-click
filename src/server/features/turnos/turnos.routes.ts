import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as turnosController from './turnos.controller'
import {
  agendaListadoSchema,
  agendaQuerySchema,
  aulasConTurnoListadoSchema,
  aulasConTurnoQuerySchema,
  materiasConTurnoListadoSchema,
  materiasConTurnoQuerySchema,
} from './turnos.validation'

// Contrato HTTP de turnos: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Turnos']

function respuestaError(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponseSchema } } }
}

const errores = {
  400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

export const listarAgendaRoute = createRoute({
  method: 'get',
  path: '/agenda',
  tags,
  summary: 'Agenda diaria del centro',
  description:
    'Turnos ACTIVO de una fecha (por defecto hoy), con alumno, profesor, materia y aula. Paginada (decisión T-35); filtrable por materia, aula, profesor (vista personal de su agenda, decisión T-37) y `q` (búsqueda por nombre de alumno o profesor, o sólo de alumno con `profesorId`, decisión T-36). Ordenada por hora y, dentro de la hora, por profesor.',
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
    ...errores,
  },
})

export const turnosRoutes = createRouter()
  .openapi(listarAgendaRoute, turnosController.listarAgenda)
  .openapi(listarMateriasConTurnoRoute, turnosController.listarMateriasConTurno)
  .openapi(listarAulasConTurnoRoute, turnosController.listarAulasConTurno)
