import type { RouteHandler } from '@hono/zod-openapi'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { ocurrenciasRepository } from './ocurrencias.repository'
import type { obtenerOcurrenciaRoute, listarOcurrenciasDelAlumnoRoute } from './ocurrencias.routes'
import { crearOcurrenciasService } from './ocurrencias.service'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const ocurrenciasService = crearOcurrenciasService({
  repository: ocurrenciasRepository,
  profesoresRepository,
})

export const obtenerOcurrencia: RouteHandler<typeof obtenerOcurrenciaRoute, AppEnv> = async (c) => {
  const { turnoId, fecha } = c.req.valid('param')
  return c.json(await ocurrenciasService.obtenerDetalle(turnoId, fecha, c.get('actor')), 200)
}

export const listarOcurrenciasDelAlumno: RouteHandler<
  typeof listarOcurrenciasDelAlumnoRoute,
  AppEnv
> = async (c) => c.json(await ocurrenciasService.listarDelAlumno(c.req.valid('query')), 200)
