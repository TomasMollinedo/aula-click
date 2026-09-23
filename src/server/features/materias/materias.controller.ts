import type { RouteHandler } from '@hono/zod-openapi'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { materiasRepository } from './materias.repository'
import type {
  crearMateriaRoute,
  darDeBajaMateriaRoute,
  listarMateriasRoute,
  obtenerMateriaRoute,
  selectorMateriasRoute,
} from './materias.routes'
import { crearMateriasService } from './materias.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service los importa como tipo).
const materiasService = crearMateriasService({
  repository: materiasRepository,
  profesoresRepository,
})

export const listar: RouteHandler<typeof listarMateriasRoute, AppEnv> = async (c) =>
  c.json(await materiasService.listar(c.req.valid('query')), 200)

export const selector: RouteHandler<typeof selectorMateriasRoute, AppEnv> = async (c) =>
  c.json(await materiasService.listarActivas(), 200)

export const obtener: RouteHandler<typeof obtenerMateriaRoute, AppEnv> = async (c) =>
  c.json(await materiasService.obtener(c.req.valid('param').id), 200)

export const crear: RouteHandler<typeof crearMateriaRoute, AppEnv> = async (c) =>
  c.json(await materiasService.crear(c.req.valid('json'), c.get('actor')), 201)

export const darDeBaja: RouteHandler<typeof darDeBajaMateriaRoute, AppEnv> = async (c) =>
  c.json(await materiasService.darDeBaja(c.req.valid('param').id, c.get('actor')), 200)
