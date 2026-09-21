import { createMiddleware } from 'hono/factory'
import { auth } from '@/lib/auth'
import { ForbiddenError, UnauthorizedError } from '@/server/errors'
import type { AppEnv } from '@/server/router'

// Responde 401 en JSON si no hay sesión. Nunca redirige (eso es del proxy de Next).
export const requireAuth = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) throw new UnauthorizedError('Se requiere iniciar sesión')

    c.set('user', session.user)
    c.set('session', session.session)
    await next()
  })

// Responde 403 si el rol del usuario no está entre los permitidos. Usar después de requireAuth().
export const requireRole = (...roles: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw new UnauthorizedError('Se requiere iniciar sesión')
    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenError('No tenés permiso para esta operación')
    }

    await next()
  })
