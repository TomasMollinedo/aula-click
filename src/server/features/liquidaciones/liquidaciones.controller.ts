import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { liquidacionesRepository } from './liquidaciones.repository'
import type {
  detalleLiquidacionRoute,
  listarLiquidacionesRoute,
  miLiquidacionRoute,
  misIngresosRoute,
  misLiquidacionesRoute,
  pagarLiquidacionRoute,
} from './liquidaciones.routes'
import { crearLiquidacionesService } from './liquidaciones.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200 o 201).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const liquidacionesService = crearLiquidacionesService({ repository: liquidacionesRepository })

export const listarLiquidaciones: RouteHandler<typeof listarLiquidacionesRoute, AppEnv> = async (
  c,
) => c.json(await liquidacionesService.listar(c.req.valid('query')), 200)

export const detalleLiquidacion: RouteHandler<typeof detalleLiquidacionRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.detalle(c.req.valid('param')), 200)

export const pagarLiquidacion: RouteHandler<typeof pagarLiquidacionRoute, AppEnv> = async (c) =>
  c.json(
    await liquidacionesService.pagar(c.req.valid('param'), c.req.valid('json'), c.get('actor')),
    201,
  )

export const misIngresos: RouteHandler<typeof misIngresosRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.misIngresos(c.get('actor')), 200)

export const misLiquidaciones: RouteHandler<typeof misLiquidacionesRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.misLiquidaciones(c.req.valid('query'), c.get('actor')), 200)

export const miLiquidacion: RouteHandler<typeof miLiquidacionRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.miLiquidacion(c.req.valid('param'), c.get('actor')), 200)
