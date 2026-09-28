import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { aulasRoutes } from '../aulas.routes'

// Contrato HTTP de aulas: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, bloquesRepository, getSession } = vi.hoisted(() => ({
  repository: { listar: vi.fn() },
  bloquesRepository: { aulasOcupadas: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../aulas.repository', () => ({ aulasRepository: repository }))
vi.mock('@/server/features/bloques/bloques.repository', () => ({ bloquesRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/aulas', aulasRoutes)

const QUERY = 'diaSemana=1&horaInicio=14:00&horaFin=16:00'

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(query: string) {
  return app.request(`/api/v1/aulas/disponibles?${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.listar.mockResolvedValue([
    { id: 1, nombre: 'Aula 1', capacidad: 8, estado: 'ACTIVO' },
    { id: 3, nombre: 'Aula 3', capacidad: 10, estado: 'ACTIVO' },
  ])
  bloquesRepository.aulasOcupadas.mockResolvedValue([3])
})

describe('GET /aulas/disponibles', () => {
  it('responde 200 con las aulas libres y coerciona el query', async () => {
    const res = await pedir(`${QUERY}&excluirBloqueId=10`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Aula 1', capacidad: 8 }])
    expect(bloquesRepository.aulasOcupadas).toHaveBeenCalledWith({
      diaSemana: 1,
      horasPedidas: [840, 900],
      excluirBloqueId: 10,
    })
  })

  it('sin aulas libres responde 200 con []', async () => {
    bloquesRepository.aulasOcupadas.mockResolvedValue([1, 3])
    const res = await pedir(QUERY)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it.each([
    ['sin diaSemana', 'horaInicio=14:00&horaFin=16:00'],
    ['sin horaInicio', 'diaSemana=1&horaFin=16:00'],
    ['sin horaFin', 'diaSemana=1&horaInicio=14:00'],
    ['diaSemana fuera de rango (0)', 'diaSemana=0&horaInicio=14:00&horaFin=16:00'],
    ['diaSemana fuera de rango (8)', 'diaSemana=8&horaInicio=14:00&horaFin=16:00'],
    ['diaSemana no numérico', 'diaSemana=lunes&horaInicio=14:00&horaFin=16:00'],
    ['hora con formato inválido', 'diaSemana=1&horaInicio=14:00:00&horaFin=16:00'],
    ['horaInicio no en punto', 'diaSemana=1&horaInicio=14:30&horaFin=16:00'],
    ['horaFin no en punto', 'diaSemana=1&horaInicio=14:00&horaFin=15:30'],
    ['horaFin igual a horaInicio', 'diaSemana=1&horaInicio=15:00&horaFin=15:00'],
    ['horaFin anterior a horaInicio', 'diaSemana=1&horaInicio=15:00&horaFin=14:00'],
    ['excluirBloqueId inválido', `${QUERY}&excluirBloqueId=0`],
  ])('%s → 400 VALIDACION, sin llegar al service', async (_caso, query) => {
    const res = await pedir(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(bloquesRepository.aulasOcupadas).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir(QUERY)).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir(QUERY)).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara el endpoint con todos sus status codes y sus parámetros', () => {
    const operacion = doc.paths['/api/v1/aulas/disponibles']?.get
    expect(Object.keys(operacion?.responses ?? {}).sort()).toEqual(['200', '400', '401', '403'])
    const nombres = (operacion?.parameters ?? []).map((p) => ('name' in p ? p.name : ''))
    expect(nombres).toEqual(['diaSemana', 'horaInicio', 'horaFin', 'excluirBloqueId'])
  })

  it('registra el componente AulaDisponible', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toContain('AulaDisponible')
  })
})
