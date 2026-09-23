import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { profesoresRoutes } from '../profesores.routes'

// Contrato HTTP de profesores: validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el
// service.

const { repository, materiasRepository, turnosRepository, getSession } = vi.hoisted(() => ({
  repository: {
    listarMateriasAsignadas: vi.fn(),
    buscarConAsignaciones: vi.fn(),
    asignarMaterias: vi.fn(),
    quitarMaterias: vi.fn(),
  },
  materiasRepository: { buscarPorIds: vi.fn() },
  turnosRepository: { contarVigentesPorMateria: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../profesores.repository', () => ({ profesoresRepository: repository }))
vi.mock('@/server/features/materias/materias.repository', () => ({ materiasRepository }))
vi.mock('@/server/features/turnos/turnos.repository', () => ({ turnosRepository }))
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

function pedir(path: string, metodo = 'GET', body?: unknown) {
  return app.request(`/api/v1/profesores${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listarMateriasAsignadas.mockResolvedValue([{ id: 2, nombre: 'Matemática' }])
  repository.buscarConAsignaciones.mockResolvedValue({ estado: 'ACTIVO', asignaciones: [] })
  repository.asignarMaterias.mockResolvedValue(undefined)
  repository.quitarMaterias.mockResolvedValue(undefined)
  turnosRepository.contarVigentesPorMateria.mockResolvedValue([])
  materiasRepository.buscarPorIds.mockResolvedValue([
    { id: 2, nombre: 'Matemática', estado: 'ACTIVO' },
  ])
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

describe('POST /profesores/{id}/materias', () => {
  it('responde 201 con las materias asignadas actualizadas y pasa el actor', async () => {
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2] })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.asignarMaterias).toHaveBeenCalledWith(3, [2], {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    repository.buscarConAsignaciones.mockResolvedValue({ estado: 'INACTIVO', asignaciones: [] })
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2] })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROFESOR_INACTIVO')
  })

  it('materia inexistente → 404 con details por posición', async () => {
    const res = await pedir('/3/materias', 'POST', { materiaIds: [2, 99] })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatchObject({
      code: 'NO_ENCONTRADO',
      details: [{ path: ['materiaIds', 1], message: 'La materia 99 no existe' }],
    })
  })

  it('sin body → 400 (SOLICITUD_INVALIDA: Hono lo rechaza antes de validar), sin llegar al service', async () => {
    const res = await pedir('/3/materias', 'POST')
    expect(res.status).toBe(400)
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it.each([
    ['sin materiaIds', {}],
    ['lista vacía', { materiaIds: [] }],
    ['ids repetidos', { materiaIds: [2, 2] }],
    ['id no entero', { materiaIds: [1.5] }],
    ['id como texto', { materiaIds: ['2'] }],
    ['id cero', { materiaIds: [0] }],
    ['más de 10 materias', { materiaIds: Array.from({ length: 11 }, (_, i) => i + 1) }],
  ])('%s → 400 VALIDACION, sin llegar al service', async (_caso, body) => {
    const res = await pedir('/3/materias', 'POST', body)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias', 'POST', { materiaIds: [2] })).status).toBe(403)
  })
})

describe('DELETE /profesores/{id}/materias', () => {
  beforeEach(() => {
    repository.buscarConAsignaciones.mockResolvedValue({
      estado: 'ACTIVO',
      asignaciones: [{ materiaId: 2, nombre: 'Matemática', estado: 'ACTIVO' }],
    })
    repository.listarMateriasAsignadas.mockResolvedValue([])
  })

  it('responde 200 con las materias asignadas actualizadas y pasa el actor', async () => {
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [2] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(repository.quitarMaterias).toHaveBeenCalledWith(3, [2], {
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad en details', async () => {
    turnosRepository.contarVigentesPorMateria.mockResolvedValue([{ materiaId: 2, cantidad: 2 }])
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [2] })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatchObject({
      code: 'TURNOS_VIGENTES',
      details: [{ path: ['materiaIds', 0], cantidad: 2 }],
    })
    expect(repository.quitarMaterias).not.toHaveBeenCalled()
  })

  it('materia no asignada → 404', async () => {
    const res = await pedir('/3/materias', 'DELETE', { materiaIds: [9] })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each([
    ['lista vacía', { materiaIds: [] }],
    ['ids repetidos', { materiaIds: [2, 2] }],
    ['más de 10 materias', { materiaIds: Array.from({ length: 11 }, (_, i) => i + 1) }],
  ])('%s → 400 VALIDACION, sin llegar al service', async (_caso, body) => {
    const res = await pedir('/3/materias', 'DELETE', body)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.buscarConAsignaciones).not.toHaveBeenCalled()
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/3/materias', 'DELETE', { materiaIds: [2] })).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (metodo: 'get' | 'post' | 'delete') =>
    Object.keys(doc.paths['/api/v1/profesores/{id}/materias']?.[metodo]?.responses ?? {}).sort()

  it('declara los endpoints con todos sus status codes', () => {
    expect(status('get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('post')).toEqual(['201', '400', '401', '403', '404', '409'])
    expect(status('delete')).toEqual(['200', '400', '401', '403', '404', '409'])
  })

  it('registra los componentes de materias asignadas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'MateriaAsignada',
        'MateriasAsignadas',
        'AsignarMaterias',
        'QuitarMaterias',
      ]),
    )
  })
})
