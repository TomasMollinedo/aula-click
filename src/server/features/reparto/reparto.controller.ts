import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { repartoRepository } from './reparto.repository'
import type { cambiarPorcentajeRoute, leerPorcentajeRoute } from './reparto.routes'
import { crearRepartoService } from './reparto.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const repartoService = crearRepartoService({ repository: repartoRepository })

export const leerPorcentaje: RouteHandler<typeof leerPorcentajeRoute, AppEnv> = async (c) =>
  c.json(await repartoService.leer(c.req.valid('query')), 200)

export const cambiarPorcentaje: RouteHandler<typeof cambiarPorcentajeRoute, AppEnv> = async (c) =>
  c.json(await repartoService.cambiar(c.req.valid('json'), c.get('actor')), 200)
