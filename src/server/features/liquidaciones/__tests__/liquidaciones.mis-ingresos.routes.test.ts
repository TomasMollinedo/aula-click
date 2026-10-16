import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { liquidacionesRoutes } from '../liquidaciones.routes'

// Contrato HTTP de "Mis ingresos" del profesor (T-126): auth, validación de Zod y OpenAPI. Sin base
// ni variables de entorno: Better Auth se reemplaza por un mock y el repository por uno falso. El
// reloj del sistema se fija en 2026-10-15 (hoy en Salta).

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    delMes: vi.fn(),
    deProfesor: vi.fn(),
    leerProfesor: vi.fn(),
    ultimoAdjunto: vi.fn(),
    pagar: vi.fn(),
    profesorIdDeUsuario: vi.fn(),
    todasDelProfesor: vi.fn(),
    clasesDelProfesor: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../liquidaciones.repository', () => ({ liquidacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/liquidaciones', liquidacionesRoutes)

function sesion(role = 'PROFESOR') {
  // La cuenta de un alumno trae su alumno (T-75): sin él, requireAuth() responde 403.
  const alumno = role === 'ALUMNO' ? { alumnoId: 7 } : {}
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_profe', role, estado: 'ACTIVO', ...alumno },
      session: { id: 's-1' },
    },
  }
}

const misIngresos = () => app.request('/api/v1/liquidaciones/mis-ingresos')
const misLiquidaciones = (query = '') =>
  app.request(`/api/v1/liquidaciones/mis-liquidaciones${query}`)
const miLiquidacion = (mes: string) => app.request(`/api/v1/liquidaciones/mis-liquidaciones/${mes}`)

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.profesorIdDeUsuario.mockResolvedValue(4)
  repository.deProfesor.mockResolvedValue(null)
  repository.clasesDelProfesor.mockResolvedValue([])
  repository.todasDelProfesor.mockResolvedValue([])
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })

    expect((await misIngresos()).status).toBe(401)
    expect((await misLiquidaciones()).status).toBe(401)
    expect((await miLiquidacion('2026-09')).status).toBe(401)
  })

  it.each(['MESA_ENTRADAS', 'GERENTE', 'ALUMNO'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))

    expect((await misIngresos()).status).toBe(403)
    expect((await misLiquidaciones()).status).toBe(403)
    expect((await miLiquidacion('2026-09')).status).toBe(403)
    expect(repository.profesorIdDeUsuario).not.toHaveBeenCalled()
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })

  it('PROFESOR sin ficha de profesor → 403 SIN_PERMISO', async () => {
    repository.profesorIdDeUsuario.mockResolvedValue(null)

    for (const res of [
      await misIngresos(),
      await misLiquidaciones(),
      await miLiquidacion('2026-09'),
    ]) {
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('SIN_PERMISO')
    }
  })
})

describe('GET /liquidaciones/mis-ingresos', () => {
  it('PROFESOR → 200 con las tres secciones', async () => {
    const res = await misIngresos()
    expect(res.status).toBe(200)
    expect(Object.keys(await res.json()).sort()).toEqual([
      'clasesCobradasSinAsistencia',
      'clasesSinCobrar',
      'esteMes',
    ])
    expect(repository.profesorIdDeUsuario).toHaveBeenCalledWith('usr_profe')
  })
})

describe('GET /liquidaciones/mis-liquidaciones', () => {
  it('PROFESOR → 200 paginado', async () => {
    const res = await misLiquidaciones('?page=1&pageSize=10')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    })
  })

  it('page=0 → 400', async () => {
    expect((await misLiquidaciones('?page=0')).status).toBe(400)
  })
})

describe('GET /liquidaciones/mis-liquidaciones/{mes}', () => {
  it('PROFESOR → 200', async () => {
    const res = await miLiquidacion('2026-09')
    expect(res.status).toBe(200)
    expect((await res.json()).mes).toBe('2026-09')
  })

  it('mes futuro → 400 en mes', async () => {
    const res = await miLiquidacion('2026-11')
    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([expect.objectContaining({ path: ['mes'] })])
  })

  it('mes con formato inválido → 400', async () => {
    expect((await miLiquidacion('2026-13')).status).toBe(400)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string) => Object.keys(doc.paths[path]?.get?.responses ?? {}).sort()

  it('declara los tres GET del profesor con sus status codes', () => {
    expect(status('/api/v1/liquidaciones/mis-ingresos')).toEqual(['200', '401', '403'])
    expect(status('/api/v1/liquidaciones/mis-liquidaciones')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/liquidaciones/mis-liquidaciones/{mes}')).toEqual([
      '200',
      '400',
      '401',
      '403',
    ])
  })

  it('declara sus componentes', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'MisIngresos',
        'MiLiquidacion',
        'MiLiquidacionCerrada',
        'TurnoDeMiLiquidacion',
        'ClaseDeMisIngresos',
        'ClaseCobradaSinAsistencia',
        'MisLiquidaciones',
        'FilaDeMisLiquidaciones',
      ]),
    )
  })
})
