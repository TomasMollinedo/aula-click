import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { liquidacionesRoutes } from '../liquidaciones.routes'

// Contrato HTTP de liquidaciones (T-124): validación de Zod, auth y OpenAPI. Sin base ni variables
// de entorno: Better Auth se reemplaza por un mock y el repository por uno falso. El reloj del
// sistema se fija en 2026-10-15 (hoy en Salta).

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    delMes: vi.fn(),
    deProfesor: vi.fn(),
    leerProfesor: vi.fn(),
    ultimoAdjunto: vi.fn(),
    pagar: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../liquidaciones.repository', () => ({ liquidacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/liquidaciones', liquidacionesRoutes)

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

const listar = (query = '') => app.request(`/api/v1/liquidaciones${query}`)
const BODY = {
  fechaTransferencia: '2026-10-05',
  numeroOperacion: '0004829137',
  comprobanteAdjuntoId: 44,
  totalConfirmado: 6800,
}

function pagar(datos?: unknown, profesorId: string | number = 4, mes = '2026-09') {
  return app.request(`/api/v1/liquidaciones/profesores/${profesorId}/${mes}/pago`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

const detalle = (profesorId: string | number, mes: string) =>
  app.request(`/api/v1/liquidaciones/profesores/${profesorId}/${mes}`)

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
  repository.delMes.mockResolvedValue([])
  repository.deProfesor.mockResolvedValue(null)
  repository.leerProfesor.mockResolvedValue({ id: 4, nombre: 'Ana', apellido: 'Gómez' })
  repository.ultimoAdjunto.mockResolvedValue(null)
  repository.pagar.mockResolvedValue({ liquidacionId: 31, total: 6800 })
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })

    expect((await listar()).status).toBe(401)
    expect((await detalle(4, '2026-09')).status).toBe(401)
    expect((await pagar(BODY)).status).toBe(401)
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))

    expect((await listar()).status).toBe(403)
    expect((await detalle(4, '2026-09')).status).toBe(403)
    expect((await pagar(BODY)).status).toBe(403)
    expect(repository.pagar).not.toHaveBeenCalled()
    expect(repository.delMes).not.toHaveBeenCalled()
    expect(repository.deProfesor).not.toHaveBeenCalled()
    expect(repository.leerProfesor).not.toHaveBeenCalled()
  })
})

describe('GET /liquidaciones', () => {
  it('GERENTE → 200 con el mes por defecto', async () => {
    const res = await listar()

    expect(res.status).toBe(200)
    expect(repository.delMes).toHaveBeenCalledWith({ mes: '2026-09', hoy: '2026-10-15' })
    expect(await res.json()).toMatchObject({ mes: '2026-09', data: [], meta: { total: 0 } })
  })

  it.each(['?mes=2026-13', '?mes=2026-9', '?pageSize=101'])('%s → 400', async (query) => {
    const res = await listar(query)

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.delMes).not.toHaveBeenCalled()
  })

  it('mes futuro → 400 en mes', async () => {
    const res = await listar('?mes=2026-11')

    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([
      { path: ['mes'], message: 'El mes no puede ser futuro' },
    ])
  })
})

describe('GET /liquidaciones/profesores/{profesorId}/{mes}', () => {
  it('GERENTE → 200', async () => {
    const res = await detalle(4, '2026-09')

    expect(res.status).toBe(200)
    expect(repository.deProfesor).toHaveBeenCalledWith({
      profesorId: 4,
      mes: '2026-09',
      hoy: '2026-10-15',
    })
    expect(await res.json()).toMatchObject({ estado: null, acciones: { registrarPago: false } })
  })

  it.each([
    ['abc', '2026-09', 'profesorId'],
    ['0', '2026-09', 'profesorId'],
    ['4', '2026-13', 'mes'],
  ])('profesorId=%s, mes=%s → 400 en %s', async (profesorId, mes, campo) => {
    const res = await detalle(profesorId, mes)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual([expect.objectContaining({ path: [campo] })])
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })

  it('profesor inexistente → 404', async () => {
    repository.leerProfesor.mockResolvedValue(null)

    const res = await detalle(99, '2026-09')

    expect(res.status).toBe(404)
    expect((await res.json()).error).toEqual({
      code: 'NO_ENCONTRADO',
      message: 'Profesor no encontrado',
    })
  })
})

describe('POST /liquidaciones/profesores/{profesorId}/{mes}/pago', () => {
  it('GERENTE → 201 con la liquidación pagada', async () => {
    const res = await pagar(BODY)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      liquidacionId: 31,
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2026-09',
      total: 6800,
      fechaTransferencia: '2026-10-05',
    })
    expect(repository.pagar).toHaveBeenCalledWith(
      expect.objectContaining({ mes: '2026-09', hoy: '2026-10-15', totalConfirmado: 6800 }),
      expect.objectContaining({ userId: 'usr_gerente', role: 'GERENTE' }),
    )
  })

  it.each([
    ['numeroOperacion vacío', { numeroOperacion: '  ' }, 'numeroOperacion'],
    ['numeroOperacion > 50', { numeroOperacion: 'x'.repeat(51) }, 'numeroOperacion'],
    ['observaciones > 500', { observaciones: 'x'.repeat(501) }, 'observaciones'],
    ['fechaTransferencia inválida', { fechaTransferencia: '05/10/2026' }, 'fechaTransferencia'],
    ['totalConfirmado 0', { totalConfirmado: 0 }, 'totalConfirmado'],
    ['comprobanteAdjuntoId 0', { comprobanteAdjuntoId: 0 }, 'comprobanteAdjuntoId'],
  ])('%s → 400 en su campo', async (_caso, cambios, campo) => {
    const res = await pagar({ ...BODY, ...cambios })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual([expect.objectContaining({ path: [campo] })])
    expect(repository.pagar).not.toHaveBeenCalled()
  })

  it('sin numeroOperacion ni totalConfirmado → un 400 por campo', async () => {
    const res = await pagar({ fechaTransferencia: '2026-10-05' })

    expect(res.status).toBe(400)
    const campos = (await res.json()).error.details.map((d: { path: string[] }) => d.path[0])
    expect(campos.sort()).toEqual(['numeroOperacion', 'totalConfirmado'])
  })

  it('sin body → 400', async () => {
    expect((await pagar()).status).toBe(400)
  })

  it('profesorId=abc → 400', async () => {
    expect((await pagar(BODY, 'abc')).status).toBe(400)
  })

  it('mes en curso → 409 CONFLICTO', async () => {
    const res = await pagar(BODY, 4, '2026-10')

    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({
      code: 'CONFLICTO',
      message: 'La liquidación de octubre de 2026 todavía no se puede pagar: el mes no terminó',
    })
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  const status = (path: string) => Object.keys(doc.paths[path]?.get?.responses ?? {}).sort()

  it('declara los dos GET con todos sus status codes', () => {
    expect(status('/api/v1/liquidaciones')).toEqual(['200', '400', '401', '403'])
    expect(status('/api/v1/liquidaciones/profesores/{profesorId}/{mes}')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
  })

  it('declara el POST del pago con todos sus status codes', () => {
    expect(
      Object.keys(
        doc.paths['/api/v1/liquidaciones/profesores/{profesorId}/{mes}/pago']?.post?.responses ??
          {},
      ).sort(),
    ).toEqual(['201', '400', '401', '403', '404', '409'])
  })

  it('declara sus componentes', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'LiquidacionesDelMes',
        'LiquidacionDelMes',
        'TotalesLiquidacion',
        'LiquidacionDetalle',
        'LiquidacionCerrada',
        'TurnoDeLiquidacion',
        'AjusteDeLiquidacion',
        'ComprobanteDeTransferencia',
        'EstadoLiquidacion',
        'PagarLiquidacion',
        'LiquidacionPagada',
      ]),
    )
  })
})
