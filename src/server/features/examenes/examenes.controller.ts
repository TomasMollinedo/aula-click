import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { examenesRepository } from './examenes.repository'
import type {
  crearExamenRoute,
  darDeBajaExamenRoute,
  editarExamenRoute,
  listarExamenesRoute,
  materiasExamenRoute,
} from './examenes.routes'
import { crearExamenesService } from './examenes.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200, 201...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service los importa como tipo).
const examenesService = crearExamenesService({
  repository: examenesRepository,
  alumnosRepository,
  materiasRepository,
  profesoresRepository,
})

export const listar: RouteHandler<typeof listarExamenesRoute, AppEnv> = async (c) =>
  c.json(await examenesService.listar(c.req.valid('query').alumnoId), 200)

export const materias: RouteHandler<typeof materiasExamenRoute, AppEnv> = async (c) =>
  c.json(
    await examenesService.materiasOfrecibles(c.req.valid('query').alumnoId, c.get('actor')),
    200,
  )

export const crear: RouteHandler<typeof crearExamenRoute, AppEnv> = async (c) =>
  c.json(await examenesService.crear(c.req.valid('json'), c.get('actor')), 201)

export const editar: RouteHandler<typeof editarExamenRoute, AppEnv> = async (c) =>
  c.json(
    await examenesService.editar(c.req.valid('param').id, c.req.valid('json'), c.get('actor')),
    200,
  )

export const darDeBaja: RouteHandler<typeof darDeBajaExamenRoute, AppEnv> = async (c) =>
  c.json(await examenesService.darDeBaja(c.req.valid('param').id, c.get('actor')), 200)
