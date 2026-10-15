import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { usuariosRepository } from './usuarios.repository'
import type { cambiarContrasenaRoute, miUsuarioRoute } from './usuarios.routes'
import { crearUsuariosService } from './usuarios.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service lo importa como tipo).
const usuariosService = crearUsuariosService({ repository: usuariosRepository })

export const miUsuario: RouteHandler<typeof miUsuarioRoute, AppEnv> = async (c) =>
  c.json(await usuariosService.miUsuario(c.get('actor')), 200)

// Los headers del pedido viajan para que Better Auth sepa de quién es la sesión.
export const cambiarContrasena: RouteHandler<typeof cambiarContrasenaRoute, AppEnv> = async (c) =>
  c.json(
    await usuariosService.cambiarContrasena(c.req.valid('json'), c.get('actor'), c.req.raw.headers),
    200,
  )
