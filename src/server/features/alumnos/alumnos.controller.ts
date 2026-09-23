import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import type {
  crearAlumnoRoute,
  editarAlumnoRoute,
  listarAlumnosRoute,
  obtenerAlumnoRoute,
} from './alumnos.routes'
import { alumnosRepository } from './alumnos.repository'
import { crearAlumnosService } from './alumnos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const alumnosService = crearAlumnosService({ repository: alumnosRepository })

export const listar: RouteHandler<typeof listarAlumnosRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.listar(c.req.valid('query')), 200)

export const obtener: RouteHandler<typeof obtenerAlumnoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.obtener(c.req.valid('param').id), 200)

export const crear: RouteHandler<typeof crearAlumnoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.crear(c.req.valid('json'), c.get('actor')), 201)

export const editar: RouteHandler<typeof editarAlumnoRoute, AppEnv> = async (c) =>
  c.json(
    await alumnosService.editar(c.req.valid('param').id, c.req.valid('json'), c.get('actor')),
    200,
  )
