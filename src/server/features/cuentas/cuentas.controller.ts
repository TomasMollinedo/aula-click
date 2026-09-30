import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { AppEnv } from '@/server/router'
import type { listarAdeudadosRoute, obtenerCuentaRoute } from './cuentas.routes'
import { cuentasRepository } from './cuentas.repository'
import { crearCuentasService } from './cuentas.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const cuentasService = crearCuentasService({ repository: cuentasRepository, alumnosRepository })

export const obtenerCuenta: RouteHandler<typeof obtenerCuentaRoute, AppEnv> = async (c) =>
  c.json(await cuentasService.obtenerCuenta(c.req.valid('param').alumnoId), 200)

export const listarAdeudados: RouteHandler<typeof listarAdeudadosRoute, AppEnv> = async (c) =>
  c.json(await cuentasService.listarAdeudados(c.req.valid('query')), 200)
