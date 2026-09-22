import { isAPIError } from 'better-auth/api'
import { createMiddleware } from 'hono/factory'
import { auth } from '@/lib/auth'
import { MENSAJE_USUARIO_INHABILITADO, USUARIO_INHABILITADO } from '@/lib/auth-reglas'
import { ForbiddenError, UnauthorizedError } from '@/server/errors'
import type { AppEnv } from '@/server/router'
import { esRole, type Role } from '@/server/shared/actor'

async function obtenerSesion(headers: Headers) {
  try {
    return await auth.api.getSession({ headers, returnHeaders: true })
  } catch (error) {
    // Por ejemplo, la sesión se borró mientras se renovaba (FAILED_TO_GET_SESSION).
    if (isAPIError(error) && error.statusCode === 401) {
      throw new UnauthorizedError('Se requiere iniciar sesión')
    }
    throw error
  }
}

/**
 * Exige una sesión válida y deja `user`, `session` y `actor` en el contexto. Chequea, en orden:
 * sesión (401 NO_AUTENTICADO) → estado del usuario (403 USUARIO_INHABILITADO) → rol (403
 * SIN_PERMISO si no es uno de ROLES). Responde en JSON; nunca redirige (eso es del proxy).
 */
export const requireAuth = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const { headers, response: sesion } = await obtenerSesion(c.req.raw.headers)

    // Cuando getSession renueva la sesión (updateAge) extiende expiresAt en la base y reemite
    // la cookie con un Max-Age nuevo; si la sesión venció, la borra. Sin reenviar esas cookies,
    // la del navegador vencería a los 60 min del login aunque el usuario siga activo.
    for (const cookie of headers?.getSetCookie() ?? []) {
      c.header('Set-Cookie', cookie, { append: true })
    }

    if (!sesion) throw new UnauthorizedError('Se requiere iniciar sesión')

    const { user, session } = sesion
    // Defensa en profundidad: si dan de baja al usuario con la sesión abierta, sus pedidos se
    // cortan en el acto aunque la sesión siga viva hasta vencer.
    if (user.estado !== 'ACTIVO') {
      throw new ForbiddenError(MENSAJE_USUARIO_INHABILITADO, { code: USUARIO_INHABILITADO })
    }
    if (!esRole(user.role)) {
      throw new ForbiddenError('No tenés permiso para esta operación')
    }

    c.set('user', user)
    c.set('session', session)
    c.set('actor', { userId: user.id, role: user.role })
    await next()
  })

/**
 * Responde 403 SIN_PERMISO si el rol del usuario no está entre los permitidos. Va siempre
 * después de requireAuth(); exige al menos un rol, y solo valores de ROLES.
 */
export const requireRole = (...roles: [Role, ...Role[]]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get('actor')
    // Error de programación: el errorHandler lo registra y responde un 500 genérico.
    if (!actor) throw new Error('requireRole() se usó sin requireAuth() antes en la ruta')
    if (!roles.includes(actor.role)) {
      throw new ForbiddenError('No tenés permiso para esta operación')
    }

    await next()
  })
