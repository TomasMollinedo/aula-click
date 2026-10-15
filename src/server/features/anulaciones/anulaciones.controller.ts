import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { anulacionesRepository } from './anulaciones.repository'
import type { anularPagoRoute, previaAnulacionRoute } from './anulaciones.routes'
import { crearAnulacionesService } from './anulaciones.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200, 201).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const anulacionesService = crearAnulacionesService({ repository: anulacionesRepository })

export const previa: RouteHandler<typeof previaAnulacionRoute, AppEnv> = async (c) =>
  c.json(await anulacionesService.previa(c.req.valid('query').pagoId), 200)

export const anular: RouteHandler<typeof anularPagoRoute, AppEnv> = async (c) =>
  c.json(await anulacionesService.anular(c.req.valid('json'), c.get('actor')), 201)
