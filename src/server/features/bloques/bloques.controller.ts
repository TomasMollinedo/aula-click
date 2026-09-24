import type { RouteHandler } from '@hono/zod-openapi'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { bloquesRepository } from './bloques.repository'
import { crearBloquesService } from './bloques.service'
import type { crearBloqueRoute } from './bloques.routes'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const bloquesService = crearBloquesService({ repository: bloquesRepository, profesoresRepository })

export const crear: RouteHandler<typeof crearBloqueRoute, AppEnv> = async (c) =>
  c.json(await bloquesService.crear(c.req.valid('json'), c.get('actor')), 201)
