import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { DATOS_CENTRO } from '../centro.datos'
import { centroRoutes } from '../centro.routes'

// Contrato HTTP de `centro` (T-64): validación de Zod, auth y OpenAPI. Sin repository que mockear
// (sin tabla): el service real lee el archivo de verdad, así se prueba también que el logo exista.

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/centro', centroRoutes)

function pedir(path: string) {
  return app.request(`/api/v1/centro${path}`)
}

function sesion(role: string) {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_1', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion('MESA_ENTRADAS'))
})

describe('GET /centro', () => {
  it.each(['MESA_ENTRADAS', 'PROFESOR', 'GERENTE'])('responde 200 para %s', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedir('')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(DATOS_CENTRO)
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('')).status).toBe(401)
  })

  it('con un rol que no es ninguno de los tres → 403', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO'))
    expect((await pedir('')).status).toBe(403)
  })
})

describe('GET /centro/logo', () => {
  it('responde 200 con la imagen y su Content-Type', async () => {
    const res = await pedir('/logo')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    expect(res.headers.get('cache-control')).toContain('max-age')
    const texto = await res.text()
    expect(texto).toContain('<svg')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/logo')).status).toBe(401)
  })

  it('con un rol que no es ninguno de los tres → 403', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO'))
    expect((await pedir('/logo')).status).toBe(403)
  })
})

describe('OpenAPI de centro', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const codigos = (path: string) =>
    Object.keys(doc.paths[`/api/v1/centro${path}`]?.get?.responses ?? {}).sort()

  it('declara los dos endpoints con 401 y 403', () => {
    expect(codigos('')).toEqual(['200', '401', '403'])
    expect(codigos('/logo')).toEqual(['200', '401', '403'])
  })
})
