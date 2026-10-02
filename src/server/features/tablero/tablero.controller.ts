import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import type { obtenerTableroRoute } from './tablero.routes'
import { tableroRepository } from './tablero.repository'
import { crearTableroService } from './tablero.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const tableroService = crearTableroService({ repository: tableroRepository })

export const obtenerTablero: RouteHandler<typeof obtenerTableroRoute, AppEnv> = async (c) =>
  c.json(await tableroService.obtener(c.req.valid('query')), 200)
