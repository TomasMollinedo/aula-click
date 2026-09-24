import type { RouteHandler } from '@hono/zod-openapi'
import { getPresignedUrl } from '@/lib/storage'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import { turnosRepository } from '@/server/features/turnos/turnos.repository'
import type { AppEnv } from '@/server/router'
import type {
  asignarMateriasRoute,
  crearProfesorRoute,
  darDeBajaProfesorRoute,
  editarProfesorRoute,
  listarMateriasAsignadasRoute,
  listarProfesoresRoute,
  obtenerProfesorRoute,
  quitarFotoRoute,
  quitarMateriasRoute,
  reactivarProfesorRoute,
  subirFotoRoute,
} from './profesores.routes'
import { profesoresRepository } from './profesores.repository'
import { crearProfesoresService } from './profesores.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const profesoresService = crearProfesoresService({
  repository: profesoresRepository,
  materiasRepository,
  turnosRepository,
  getPresignedUrl,
})

export const listar: RouteHandler<typeof listarProfesoresRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.listar(c.req.valid('query')), 200)

export const obtener: RouteHandler<typeof obtenerProfesorRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.obtener(c.req.valid('param').id), 200)

export const crear: RouteHandler<typeof crearProfesorRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.crear(c.req.valid('json'), c.get('actor')), 201)

export const editar: RouteHandler<typeof editarProfesorRoute, AppEnv> = async (c) =>
  c.json(
    await profesoresService.editar(c.req.valid('param').id, c.req.valid('json'), c.get('actor')),
    200,
  )

export const darDeBaja: RouteHandler<typeof darDeBajaProfesorRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.darDeBaja(c.req.valid('param').id, c.get('actor')), 200)

export const reactivar: RouteHandler<typeof reactivarProfesorRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.reactivar(c.req.valid('param').id, c.get('actor')), 200)

export const subirFoto: RouteHandler<typeof subirFotoRoute, AppEnv> = async (c) =>
  c.json(
    await profesoresService.subirFoto(
      c.req.valid('param').id,
      c.req.valid('form').foto,
      c.get('actor'),
    ),
    200,
  )

export const quitarFoto: RouteHandler<typeof quitarFotoRoute, AppEnv> = async (c) =>
  c.json(await profesoresService.quitarFoto(c.req.valid('param').id, c.get('actor')), 200)

export const listarMateriasAsignadas: RouteHandler<
  typeof listarMateriasAsignadasRoute,
  AppEnv
> = async (c) =>
  c.json(await profesoresService.listarMateriasAsignadas(c.req.valid('param').id), 200)

export const asignarMaterias: RouteHandler<typeof asignarMateriasRoute, AppEnv> = async (c) =>
  c.json(
    await profesoresService.asignarMaterias(
      c.req.valid('param').id,
      c.req.valid('json'),
      c.get('actor'),
    ),
    201,
  )

export const quitarMaterias: RouteHandler<typeof quitarMateriasRoute, AppEnv> = async (c) =>
  c.json(
    await profesoresService.quitarMaterias(
      c.req.valid('param').id,
      c.req.valid('json'),
      c.get('actor'),
    ),
    200,
  )
