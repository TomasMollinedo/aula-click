import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import type { FilaPorcentaje } from '../reparto.repository'
import { repartoRoutes } from '../reparto.routes'

// Contrato HTTP de reparto (T-120): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: Better Auth se reemplaza por un mock y el repository por una tabla en memoria.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { leerVigente: vi.fn(), leerHistorial: vi.fn(), crear: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../reparto.repository', () => ({ repartoRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/reparto', repartoRoutes)

const MENSAJE_INVALIDO =
  'El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales'

const USUARIOS: Record<string, { id: string; nombre: string; apellido: string }> = {
  usr_gerente: { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' },
  usr_seed: { id: 'usr_seed', nombre: 'Gerente', apellido: 'Seed' },
}

// Tabla en memoria: el repository la ordena como `ORDEN_VIGENTE` (más reciente primero).
let tabla: FilaPorcentaje[]
let reloj: number

const ordenada = () =>
  [...tabla].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)

function sesion(role = 'GERENTE') {
  // La cuenta de un alumno trae su alumno (T-75): sin él, requireAuth() responde 403.
  const alumno = role === 'ALUMNO' ? { alumnoId: 7 } : {}
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_gerente', role, estado: 'ACTIVO', ...alumno },
      session: { id: 's-1' },
    },
  }
}

const leer = (query = '') => app.request(`/api/v1/reparto/porcentaje${query}`)

function cambiar(datos?: unknown) {
  return app.request('/api/v1/reparto/porcentaje', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  reloj = Date.parse('2026-10-15T20:10:00.000Z')
  tabla = [
    {
      id: 1,
      porcentaje: 12,
      createdAt: new Date('2026-08-01T03:00:00.000Z'),
      createdBy: USUARIOS.usr_seed!,
    },
    {
      id: 2,
      porcentaje: 15,
      createdAt: new Date('2026-09-01T03:00:00.000Z'),
      createdBy: USUARIOS.usr_seed!,
    },
  ]
  repository.leerVigente.mockImplementation(async () => ordenada()[0] ?? null)
  repository.leerHistorial.mockImplementation(async ({ skip, take }) => ({
    filas: ordenada().slice(skip, skip + take),
    total: tabla.length,
  }))
  repository.crear.mockImplementation(async ({ porcentaje, createdById }) => {
    const fila = {
      id: tabla.length + 1,
      porcentaje,
      createdAt: new Date(reloj),
      createdBy: USUARIOS[createdById]!,
    }
    tabla.push(fila)
    return fila
  })
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await leer()).status).toBe(401)
    expect((await cambiar({ porcentaje: 18 })).status).toBe(401)
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    expect((await leer()).status).toBe(403)
    expect((await cambiar({ porcentaje: 18 })).status).toBe(403)
    expect(repository.leerVigente).not.toHaveBeenCalled()
    expect(repository.leerHistorial).not.toHaveBeenCalled()
    expect(repository.crear).not.toHaveBeenCalled()
  })
})

describe('GET /reparto/porcentaje', () => {
  it('200 con el vigente y el historial paginado', async () => {
    const res = await leer('?page=2&pageSize=1')

    expect(res.status).toBe(200)
    expect(repository.leerHistorial).toHaveBeenCalledWith({ skip: 1, take: 1 })
    expect(await res.json()).toEqual({
      vigente: {
        porcentaje: 15,
        desde: '2026-09-01T03:00:00.000Z',
        cambiadoPor: USUARIOS.usr_seed,
      },
      historial: {
        data: [
          {
            id: 1,
            porcentaje: 12,
            desde: '2026-08-01T03:00:00.000Z',
            cambiadoPor: USUARIOS.usr_seed,
          },
        ],
        meta: { page: 2, pageSize: 1, total: 2, totalPages: 2 },
      },
    })
  })

  it('pageSize=101 → 400', async () => {
    const res = await leer('?pageSize=101')

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin ningún porcentaje → 500 ERROR_INTERNO sin exponer el texto', async () => {
    tabla = []
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await leer()

    expect(res.status).toBe(500)
    expect((await res.json()).error).toEqual({
      code: 'ERROR_INTERNO',
      message: 'Error interno del servidor',
    })
  })
})

describe('PUT /reparto/porcentaje', () => {
  it.each([
    ['-1', -1],
    ['100', 100],
    ['15.123', 15.123],
    ['"15"', '15'],
    ['null', null],
  ])('%s → 400 con un solo mensaje en porcentaje', async (_caso, porcentaje) => {
    const res = await cambiar({ porcentaje })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual([
      expect.objectContaining({ path: ['porcentaje'], message: MENSAJE_INVALIDO }),
    ])
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('sin body → 400', async () => {
    const res = await cambiar()

    expect(res.status).toBe(400)
    expect(repository.crear).not.toHaveBeenCalled()
  })

  it('body sin porcentaje → 400 con el mensaje', async () => {
    const res = await cambiar({})

    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([
      expect.objectContaining({ path: ['porcentaje'], message: MENSAJE_INVALIDO }),
    ])
  })

  it.each([0, 99.99])('%d es válido → 200', async (porcentaje) => {
    const res = await cambiar({ porcentaje })

    expect(res.status).toBe(200)
    expect((await res.json()).porcentaje).toBe(porcentaje)
  })

  it('igual al vigente → 400 "El porcentaje ya es 15 %"', async () => {
    const res = await cambiar({ porcentaje: 15 })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([
      { path: ['porcentaje'], message: 'El porcentaje ya es 15 %' },
    ])
    expect(repository.crear).not.toHaveBeenCalled()
  })
})

describe('criterio de aceptación', () => {
  it('de 15 a 18: el historial muestra los dos, con quién y desde cuándo', async () => {
    const put = await cambiar({ porcentaje: 18 })

    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({
      porcentaje: 18,
      desde: '2026-10-15T20:10:00.000Z',
      cambiadoPor: USUARIOS.usr_gerente,
    })

    const get = await leer()

    expect(get.status).toBe(200)
    const json = await get.json()
    expect(json.vigente.porcentaje).toBe(18)
    expect(json.historial.data).toEqual([
      {
        id: 3,
        porcentaje: 18,
        desde: '2026-10-15T20:10:00.000Z',
        cambiadoPor: USUARIOS.usr_gerente,
      },
      {
        id: 2,
        porcentaje: 15,
        desde: '2026-09-01T03:00:00.000Z',
        cambiadoPor: USUARIOS.usr_seed,
      },
      {
        id: 1,
        porcentaje: 12,
        desde: '2026-08-01T03:00:00.000Z',
        cambiadoPor: USUARIOS.usr_seed,
      },
    ])
  })
})
