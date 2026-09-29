import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { AppEnv } from '@/server/router'
import type { obtenerComprobanteRoute, registrarPagoRoute } from './pagos.routes'
import { pagosRepository } from './pagos.repository'
import { crearPagosService } from './pagos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const pagosService = crearPagosService({ repository: pagosRepository, alumnosRepository })

export const registrar: RouteHandler<typeof registrarPagoRoute, AppEnv> = async (c) =>
  c.json(await pagosService.registrar(c.req.valid('json'), c.get('actor')), 201)

export const obtenerComprobante: RouteHandler<typeof obtenerComprobanteRoute, AppEnv> = async (c) =>
  c.json(await pagosService.obtenerComprobante(c.req.valid('param').id), 200)
