import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { turnosRoutes } from '../turnos.routes'

// Contrato HTTP de turnos: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    listarAgenda: vi.fn(),
    listarMateriasConTurno: vi.fn(),
    listarProfesoresConTurno: vi.fn(),
    listarAulasConTurno: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../turnos.repository', () => ({ turnosRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/turnos', turnosRoutes)

const paginaVacia = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(query = '') {
  return app.request(`/api/v1/turnos/agenda${query}`)
}

function pedirMaterias(query = '') {
  return app.request(`/api/v1/turnos/materias${query}`)
}

function pedirProfesores(query = '') {
  return app.request(`/api/v1/turnos/profesores${query}`)
}

function pedirAulas(query = '') {
  return app.request(`/api/v1/turnos/aulas${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listarAgenda.mockResolvedValue(paginaVacia)
  repository.listarMateriasConTurno.mockResolvedValue([])
  repository.listarProfesoresConTurno.mockResolvedValue([])
  repository.listarAulasConTurno.mockResolvedValue([])
})

describe('GET /turnos/agenda', () => {
  it('responde 200 con la página que arma el service', async () => {
    const res = await pedir()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(paginaVacia)
  })

  it('sin query, pagina con los defaults y sin fecha (el service la completa)', async () => {
    await pedir()
    expect(repository.listarAgenda).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    )
  })

  it('pasa fecha, materiaId, aulaId, profesorId y alumnoId al service', async () => {
    await pedir('?fecha=2026-09-28&materiaId=2&aulaId=1&profesorId=3&alumnoId=12')
    expect(repository.listarAgenda).toHaveBeenCalledWith({
      fecha: '2026-09-28',
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
      alumnoId: 12,
      page: 1,
      pageSize: 20,
    })
  })

  it.each([
    ['fecha con formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
    ['materiaId no numérico', '?materiaId=abc'],
    ['aulaId cero', '?aulaId=0'],
    ['profesorId negativo', '?profesorId=-1'],
    ['alumnoId no entero', '?alumnoId=1.5'],
    ['pageSize mayor a 100', '?pageSize=101'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir()).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir()).status).toBe(403)
  })
})

describe('GET /turnos/materias', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.listarMateriasConTurno.mockResolvedValue([{ id: 2, nombre: 'Matemática' }])
    const res = await pedirMaterias('?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.listarMateriasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    const res = await pedirMaterias()
    expect(res.status).toBe(200)
    expect(repository.listarMateriasConTurno).toHaveBeenCalledWith(expect.any(String))
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirMaterias(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirMaterias('?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirMaterias('?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('GET /turnos/profesores', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.listarProfesoresConTurno.mockResolvedValue([
      { id: 3, apellido: 'Pérez', nombre: 'Ana' },
    ])
    const res = await pedirProfesores('?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 3, apellido: 'Pérez', nombre: 'Ana' }])
    expect(repository.listarProfesoresConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    const res = await pedirProfesores()
    expect(res.status).toBe(200)
    expect(repository.listarProfesoresConTurno).toHaveBeenCalledWith(expect.any(String))
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirProfesores(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirProfesores('?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirProfesores('?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('GET /turnos/aulas', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.listarAulasConTurno.mockResolvedValue([{ id: 1, nombre: 'Aula 1' }])
    const res = await pedirAulas('?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Aula 1' }])
    expect(repository.listarAulasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    const res = await pedirAulas()
    expect(res.status).toBe(200)
    expect(repository.listarAulasConTurno).toHaveBeenCalledWith(expect.any(String))
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirAulas(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirAulas('?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirAulas('?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara los endpoints con todos sus status codes', () => {
    const responsesAgenda = doc.paths['/api/v1/turnos/agenda']?.get?.responses ?? {}
    expect(Object.keys(responsesAgenda).sort()).toEqual(['200', '400', '401', '403'])

    const responsesMaterias = doc.paths['/api/v1/turnos/materias']?.get?.responses ?? {}
    expect(Object.keys(responsesMaterias).sort()).toEqual(['200', '400', '401', '403'])

    const responsesProfesores = doc.paths['/api/v1/turnos/profesores']?.get?.responses ?? {}
    expect(Object.keys(responsesProfesores).sort()).toEqual(['200', '400', '401', '403'])

    const responsesAulas = doc.paths['/api/v1/turnos/aulas']?.get?.responses ?? {}
    expect(Object.keys(responsesAulas).sort()).toEqual(['200', '400', '401', '403'])
  })

  it('registra los componentes de agenda y de los selectores de materias, profesores y aulas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['AgendaItem', 'MateriaConTurno', 'ProfesorConTurno', 'AulaConTurno']),
    )
  })
})
