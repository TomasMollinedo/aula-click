import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { finalizacionesRepository } from './finalizaciones.repository'
import type { finalizarTurnoRoute, previaFinalizacionRoute } from './finalizaciones.routes'
import { crearFinalizacionesService } from './finalizaciones.service'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const finalizacionesService = crearFinalizacionesService({ repository: finalizacionesRepository })

export const previa: RouteHandler<typeof previaFinalizacionRoute, AppEnv> = async (c) =>
  c.json(await finalizacionesService.previa(c.req.valid('query')), 200)

export const finalizar: RouteHandler<typeof finalizarTurnoRoute, AppEnv> = async (c) =>
  c.json(await finalizacionesService.finalizar(c.req.valid('json'), c.get('actor')), 201)
