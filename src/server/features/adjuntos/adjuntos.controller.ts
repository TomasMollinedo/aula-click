import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import type { subirAdjuntoRoute } from './adjuntos.routes'
import { adjuntosRepository } from './adjuntos.repository'
import { crearAdjuntosService } from './adjuntos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const adjuntosService = crearAdjuntosService({ repository: adjuntosRepository })

export const subir: RouteHandler<typeof subirAdjuntoRoute, AppEnv> = async (c) =>
  c.json(await adjuntosService.subir(c.req.valid('form').archivo, c.get('actor')), 201)
