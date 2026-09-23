import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { profesoresRoutes } from '../profesores.routes'

// Contrato HTTP de profesores: validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { listarMateriasAsignadas: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../profesores.repository', () => ({ profesoresRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/profesores', profesoresRoutes)

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string) {
  return app.request(`/api/v1/profesores${path}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listarMateriasAsignadas.mockResolvedValue([{ id: 2, nombre: 'Matemática' }])
})

describe('GET /profesores/{id}/materias', () => {
  it('responde 200 con un arreglo, sin envolver en { data }', async () => {
    const res = await pedir('/3/materias')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.listarMateriasAsignadas).toHaveBeenCalledWith(3)
  })

  it('profesor inexistente → 404 NO_ENCONTRADO', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue(null)
    const res = await pedir('/99/materias')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/abc', '/0', '/-1', '/1.5'])('id inválido %s → 400', async (id) => {
    const res = await pedir(`${id}/materias`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/3/materias')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias')).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara el endpoint con todos sus status codes', () => {
    const responses = doc.paths['/api/v1/profesores/{id}/materias']?.get?.responses ?? {}
    expect(Object.keys(responses).sort()).toEqual(['200', '400', '401', '403', '404'])
  })

  it('registra los componentes de materias asignadas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['MateriaAsignada', 'MateriasAsignadas']),
    )
  })
})
