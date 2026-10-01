import type { RouteHandler } from '@hono/zod-openapi'
import { aulasRepository } from '@/server/features/aulas/aulas.repository'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { agendasRepository } from './agendas.repository'
import type {
  listarAgendaCentroRoute,
  listarAgendaProfesorRoute,
  listarAgendaPropiaRoute,
  listarAgendaRoute,
  listarAulasConTurnoRoute,
  listarMateriasConTurnoRoute,
} from './agendas.routes'
import { crearAgendasService } from './agendas.service'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const agendasService = crearAgendasService({
  repository: agendasRepository,
  profesoresRepository,
  aulasRepository,
})

export const listarAgenda: RouteHandler<typeof listarAgendaRoute, AppEnv> = async (c) =>
  c.json(await agendasService.listarAgenda(c.req.valid('query')), 200)

// El profesor sale del Actor de la sesión: nunca de un parámetro (HU-10).
export const listarAgendaPropia: RouteHandler<typeof listarAgendaPropiaRoute, AppEnv> = async (c) =>
  c.json(await agendasService.listarAgendaPropia(c.req.valid('query'), c.get('actor')), 200)

export const listarAgendaDeProfesor: RouteHandler<
  typeof listarAgendaProfesorRoute,
  AppEnv
> = async (c) => c.json(await agendasService.listarAgendaDeProfesor(c.req.valid('query')), 200)

export const listarAgendaDelCentro: RouteHandler<typeof listarAgendaCentroRoute, AppEnv> = async (
  c,
) => c.json(await agendasService.listarAgendaDelCentro(c.req.valid('query')), 200)

export const listarMateriasConTurno: RouteHandler<
  typeof listarMateriasConTurnoRoute,
  AppEnv
> = async (c) => c.json(await agendasService.listarMateriasConTurno(c.req.valid('query')), 200)

export const listarAulasConTurno: RouteHandler<typeof listarAulasConTurnoRoute, AppEnv> = async (
  c,
) => c.json(await agendasService.listarAulasConTurno(c.req.valid('query')), 200)
