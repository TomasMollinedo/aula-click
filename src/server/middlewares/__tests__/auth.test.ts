import { createRoute, z } from '@hono/zod-openapi'
import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { Session } from '@/lib/auth'
import { ErrorResponseSchema, errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import type { Role } from '@/server/shared/actor'
import { requireAuth, requireRole } from '../auth'

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))

// Lo que devuelve getSession({ returnHeaders: true }): { headers, response }.
function sesion(user: Record<string, unknown> = {}, setCookies: string[] = []) {
  const headers = new Headers()
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie)
  return {
    headers,
    response: {
      user: { id: 'u-1', email: 'mesa@x.com', role: 'MESA_ENTRADAS', estado: 'ACTIVO', ...user },
      session: { id: 's-1', userId: 'u-1', token: 't' },
    },
  }
}

function crearApp() {
  const app = createRouter()
  app.onError(errorHandler)
  app.get('/mesa', requireAuth(), requireRole('MESA_ENTRADAS'), (c) => c.json(c.get('actor')))
  app.get('/varios', requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE'), (c) =>
    c.json(c.get('actor')),
  )
  app.get('/sin-auth', requireRole('MESA_ENTRADAS'), (c) => c.json({ ok: true }))
  return app
}

async function pedir(path: string, init?: RequestInit) {
  const res = await crearApp().request(path, init)
  return { res, body: await res.json() }
}

beforeEach(() => {
  mockGetSession.mockReset()
})

describe('requireAuth', () => {
  it('sin sesión responde 401 NO_AUTENTICADO', async () => {
    mockGetSession.mockResolvedValue({ headers: new Headers(), response: null })

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('NO_AUTENTICADO')
  })

  it('si getSession falla con un APIError 401 responde 401 NO_AUTENTICADO', async () => {
    mockGetSession.mockRejectedValue(
      APIError.from('UNAUTHORIZED', { code: 'FAILED_TO_GET_SESSION', message: 'x' }),
    )

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('NO_AUTENTICADO')
  })

  it('llama a getSession con los headers del request y returnHeaders', async () => {
    mockGetSession.mockResolvedValue(sesion())

    await pedir('/mesa', { headers: { cookie: 'better-auth.session_token=abc' } })

    const [argumento] = mockGetSession.mock.calls[0]
    expect(argumento.returnHeaders).toBe(true)
    expect(argumento.headers.get('cookie')).toBe('better-auth.session_token=abc')
  })

  it('con rol permitido deja el Actor { userId, role } en el contexto', async () => {
    mockGetSession.mockResolvedValue(sesion())

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(200)
    expect(body).toEqual({ userId: 'u-1', role: 'MESA_ENTRADAS' })
  })

  it('con usuario INACTIVO responde 403 USUARIO_INHABILITADO', async () => {
    mockGetSession.mockResolvedValue(sesion({ estado: 'INACTIVO' }))

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(403)
    expect(body.error).toEqual({
      code: 'USUARIO_INHABILITADO',
      message: 'Su usuario no está habilitado',
    })
  })

  it.each([
    ['sin rol', { role: undefined }],
    ['rol null', { role: null }],
    ['rol vacío', { role: '' }],
    ['rol fuera de ROLES', { role: 'ADMIN' }],
    ['rol en minúsculas', { role: 'mesa_entradas' }],
  ])('%s responde 403 SIN_PERMISO', async (_caso, user) => {
    mockGetSession.mockResolvedValue(sesion(user))

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(403)
    expect(body.error.code).toBe('SIN_PERMISO')
  })

  it('reenvía los Set-Cookie de getSession (renovación de la sesión)', async () => {
    const cookies = [
      'better-auth.session_token=nuevo; Max-Age=3600; Path=/; HttpOnly',
      'better-auth.session_data=; Max-Age=0; Path=/',
    ]
    mockGetSession.mockResolvedValue(sesion({}, cookies))

    const { res } = await pedir('/mesa')

    expect(res.status).toBe(200)
    expect(res.headers.getSetCookie()).toEqual(cookies)
  })

  it('reenvía los Set-Cookie también cuando responde con error', async () => {
    const borrado = 'better-auth.session_token=; Max-Age=0; Path=/'
    mockGetSession.mockResolvedValue({
      headers: new Headers({ 'Set-Cookie': borrado }),
      response: null,
    })

    const { res } = await pedir('/mesa')

    expect(res.status).toBe(401)
    expect(res.headers.getSetCookie()).toEqual([borrado])
  })

  it('reenvía los Set-Cookie en el 403 de usuario inhabilitado', async () => {
    const cookie = 'better-auth.session_token=nuevo; Max-Age=3600; Path=/'
    mockGetSession.mockResolvedValue(sesion({ estado: 'INACTIVO' }, [cookie]))

    const { res } = await pedir('/mesa')

    expect(res.status).toBe(403)
    expect(res.headers.getSetCookie()).toEqual([cookie])
  })
})

describe('requireRole', () => {
  it('con un rol no permitido responde 403 SIN_PERMISO', async () => {
    mockGetSession.mockResolvedValue(sesion({ role: 'PROFESOR' }))

    const { res, body } = await pedir('/mesa')

    expect(res.status).toBe(403)
    expect(body.error).toEqual({
      code: 'SIN_PERMISO',
      message: 'No tenés permiso para esta operación',
    })
  })

  it.each(['MESA_ENTRADAS', 'GERENTE'])('con varios roles acepta %s', async (role) => {
    mockGetSession.mockResolvedValue(sesion({ role }))

    const { res, body } = await pedir('/varios')

    expect(res.status).toBe(200)
    expect(body.role).toBe(role)
  })

  it('con varios roles rechaza uno que no está en la lista', async () => {
    mockGetSession.mockResolvedValue(sesion({ role: 'ALUMNO' }))

    const { res } = await pedir('/varios')

    expect(res.status).toBe(403)
  })

  it('sin requireAuth antes responde 500 genérico, sin filtrar el detalle', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { res, body } = await pedir('/sin-auth')

    expect(res.status).toBe(500)
    expect(body.error).toEqual({ code: 'ERROR_INTERNO', message: 'Error interno del servidor' })
    expect(consola).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('requireAuth()') }),
    )
    consola.mockRestore()
  })

  it('solo acepta valores de ROLES y al menos uno (tipos)', () => {
    // @ts-expect-error: 'ADMIN' no es un Role.
    requireRole('ADMIN')
    // @ts-expect-error: hace falta al menos un rol.
    requireRole()
    expectTypeOf(requireRole).parameters.toEqualTypeOf<[Role, ...Role[]]>()
  })

  it('el role de la sesión de Better Auth está tipado como Role (tipos)', () => {
    expectTypeOf<Session['user']['role']>().toEqualTypeOf<Role>()
  })
})

describe('uso en createRoute()', () => {
  // Misma forma que la receta de docs/arquitectura-backend.md → Cambios frecuentes.
  const errorJson = (description: string) => ({
    content: { 'application/json': { schema: ErrorResponseSchema } },
    description,
  })
  const ruta = createRoute({
    method: 'get',
    path: '/protegida',
    middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ userId: z.string() }) } },
        description: 'OK',
      },
      401: errorJson('Sin sesión'),
      403: errorJson('Rol no permitido'),
    },
  })

  function crearAppOpenApi() {
    const app = createRouter()
    app.onError(errorHandler)
    return app.openapi(ruta, (c) => {
      const actor = c.get('actor')
      expectTypeOf(actor.role).toEqualTypeOf<Role>()
      return c.json({ userId: actor.userId }, 200)
    })
  }

  it('protege la ruta y el handler recibe el Actor', async () => {
    mockGetSession.mockResolvedValue(sesion())
    const ok = await crearAppOpenApi().request('/protegida')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ userId: 'u-1' })

    mockGetSession.mockResolvedValue(sesion({ role: 'PROFESOR' }))
    expect((await crearAppOpenApi().request('/protegida')).status).toBe(403)
  })
})
