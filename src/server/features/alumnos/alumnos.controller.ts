import type { RouteHandler } from '@hono/zod-openapi'
import { getPresignedUrl } from '@/lib/storage'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import type {
  crearAccesoRoute,
  crearAlumnoRoute,
  editarAlumnoRoute,
  listarAlumnosRoute,
  listarMisAlumnosRoute,
  miPerfilRoute,
  obtenerAlumnoRoute,
  quitarFotoRoute,
  restablecerContrasenaRoute,
  subirFotoRoute,
  usuarioSugeridoRoute,
} from './alumnos.routes'
import { alumnosRepository } from './alumnos.repository'
import { crearAlumnosService } from './alumnos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const alumnosService = crearAlumnosService({
  repository: alumnosRepository,
  profesoresRepository,
  getPresignedUrl,
})

export const listar: RouteHandler<typeof listarAlumnosRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.listar(c.req.valid('query')), 200)

export const listarMisAlumnos: RouteHandler<typeof listarMisAlumnosRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.listarMisAlumnos(c.req.valid('query'), c.get('actor')), 200)

export const obtener: RouteHandler<typeof obtenerAlumnoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.obtener(c.req.valid('param').id), 200)

export const crear: RouteHandler<typeof crearAlumnoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.crear(c.req.valid('json'), c.get('actor')), 201)

export const editar: RouteHandler<typeof editarAlumnoRoute, AppEnv> = async (c) =>
  c.json(
    await alumnosService.editar(c.req.valid('param').id, c.req.valid('json'), c.get('actor')),
    200,
  )

export const usuarioSugerido: RouteHandler<typeof usuarioSugeridoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.usuarioSugerido(c.req.valid('query')), 200)

// Endpoint del portal: el alumno sale del Actor de la sesión, nunca de un parámetro.
export const miPerfil: RouteHandler<typeof miPerfilRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.miPerfil(c.get('actor')), 200)

export const subirFoto: RouteHandler<typeof subirFotoRoute, AppEnv> = async (c) =>
  c.json(
    await alumnosService.subirFoto(
      c.req.valid('param').id,
      c.req.valid('form').foto,
      c.get('actor'),
    ),
    200,
  )

export const quitarFoto: RouteHandler<typeof quitarFotoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.quitarFoto(c.req.valid('param').id, c.get('actor')), 200)

export const crearAcceso: RouteHandler<typeof crearAccesoRoute, AppEnv> = async (c) =>
  c.json(await alumnosService.crearAcceso(c.req.valid('param').id, c.get('actor')), 201)

export const restablecerContrasena: RouteHandler<
  typeof restablecerContrasenaRoute,
  AppEnv
> = async (c) =>
  c.json(await alumnosService.restablecerContrasena(c.req.valid('param').id, c.get('actor')), 200)
