import { OpenAPIHono } from '@hono/zod-openapi'
import type { Session } from '@/lib/auth'
import { ValidationError } from './errors'

export type AppEnv = {
  Variables: {
    user: Session['user']
    session: Session['session']
  }
}

// Todo router (el principal y el de cada feature) se crea acá, así un dato inválido
// siempre llega a app.onError como ValidationError (400) con el mismo formato.
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        throw new ValidationError('Datos de entrada inválidos', {
          details: result.error.issues,
        })
      }
    },
  })
}
