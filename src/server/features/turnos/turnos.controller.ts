import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import type { listarAgendaRoute, listarMateriasConTurnoRoute } from './turnos.routes'
import { turnosRepository } from './turnos.repository'
import { crearTurnosService } from './turnos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const turnosService = crearTurnosService({ repository: turnosRepository })

export const listarAgenda: RouteHandler<typeof listarAgendaRoute, AppEnv> = async (c) =>
  c.json(await turnosService.listarAgenda(c.req.valid('query')), 200)

export const listarMateriasConTurno: RouteHandler<
  typeof listarMateriasConTurnoRoute,
  AppEnv
> = async (c) => c.json(await turnosService.listarMateriasConTurno(c.req.valid('query')), 200)
