import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { cancelacionesRepository } from './cancelaciones.repository'
import type { cancelarTurnosRoute } from './cancelaciones.routes'
import { crearCancelacionesService } from './cancelaciones.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const cancelacionesService = crearCancelacionesService({ repository: cancelacionesRepository })

export const cancelar: RouteHandler<typeof cancelarTurnosRoute, AppEnv> = async (c) =>
  c.json(await cancelacionesService.cancelar(c.req.valid('json'), c.get('actor')), 201)
