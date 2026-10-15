import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { anulacionesRoutes } from '../anulaciones.routes'

// Contrato HTTP de anulaciones (T-104): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { leerPago: vi.fn(), leerContextoDePrevia: vi.fn(), anular: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../anulaciones.repository', () => ({ anulacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/anulaciones', anulacionesRoutes)

const juan = { id: 12, nombre: 'Juan', apellido: 'Pérez' }
const pagoVigente = {
  id: 31,
  numeroComprobante: 123,
  estado: 'VIGENTE',
  alumno: juan,
  total: 32000,
  turnos: [
    { turnoId: 41, fecha: '2999-10-05', materia: { id: 2, nombre: 'Matemática' }, importe: 8000 },
    { turnoId: 41, fecha: '2999-10-12', materia: { id: 2, nombre: 'Matemática' }, importe: 8000 },
  ],
  transferencia: null,
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function anular(datos?: unknown) {
  return app.request('/api/v1/anulaciones', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

const previa = (query = '?pagoId=31') => app.request(`/api/v1/anulaciones/previa${query}`)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerPago.mockResolvedValue(pagoVigente)
  repository.leerContextoDePrevia.mockResolvedValue({
    deudaVencida: { cantidad: 0, total: 0 },
    precios: new Map([[2, 8000]]),
    otrosPagos: [],
  })
  repository.anular.mockImplementation(
    async (_entrada, verificar) => verificar(pagoVigente).turnos.length,
  )
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await anular({ pagoId: 31, motivo: 'ERROR_CARGA' })).status).toBe(401)
    expect((await previa()).status).toBe(401)
  })

  it.each(['PROFESOR', 'GERENTE', 'ALUMNO'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    expect((await anular({ pagoId: 31, motivo: 'ERROR_CARGA' })).status).toBe(403)
    expect((await previa()).status).toBe(403)
    expect(repository.anular).not.toHaveBeenCalled()
  })
})

describe('GET /anulaciones/previa', () => {
  it('200 con el resumen y los avisos', async () => {
    const res = await previa()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      pago: { id: 31, numeroComprobante: 123, alumno: juan, total: 32000, cantidad: 2 },
      avisos: { deuda: null, precios: [], transferenciaCompartida: null },
    })
  })

  it.each(['', '?pagoId=abc', '?pagoId=0', '?pagoId=-3', '?pagoId=1.5'])(
    'query %j → 400 VALIDACION en pagoId',
    async (query) => {
      const res = await previa(query)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error.code).toBe('VALIDACION')
      expect(json.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['pagoId'] })]),
      )
    },
  )

  it('pago inexistente → 404', async () => {
    repository.leerPago.mockResolvedValue(null)
    expect((await previa()).status).toBe(404)
  })

  it('pago anulado → 409 PAGO_ANULADO', async () => {
    repository.leerPago.mockResolvedValue({ ...pagoVigente, estado: 'ANULADO' })

    const res = await previa()

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PAGO_ANULADO')
  })
})

describe('POST /anulaciones', () => {
  it('201 con { pagoId, cantidad } y el detalle guardado sin espacios', async () => {
    const res = await anular({ pagoId: 31, motivo: 'OTRO', detalle: '  Alumno equivocado  ' })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ pagoId: 31, cantidad: 2 })
    expect(repository.anular.mock.calls[0]?.[0]).toEqual({
      pagoId: 31,
      alumnoId: 12,
      motivo: 'OTRO',
      detalle: 'Alumno equivocado',
    })
  })

  it.each([
    ['sin pagoId', { motivo: 'ERROR_CARGA' }, ['pagoId']],
    ['pagoId inválido', { pagoId: 0, motivo: 'ERROR_CARGA' }, ['pagoId']],
    ['sin motivo', { pagoId: 31 }, ['motivo']],
    ['motivo inválido', { pagoId: 31, motivo: 'PORQUE_SI' }, ['motivo']],
    ['OTRO sin detalle', { pagoId: 31, motivo: 'OTRO' }, ['detalle']],
    ['OTRO con detalle en blanco', { pagoId: 31, motivo: 'OTRO', detalle: '   ' }, ['detalle']],
    [
      'detalle de más de 500',
      { pagoId: 31, motivo: 'ERROR_CARGA', detalle: 'x'.repeat(501) },
      ['detalle'],
    ],
  ])('%s → 400 VALIDACION en el campo', async (_, datos, path) => {
    const res = await anular(datos)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.anular).not.toHaveBeenCalled()
  })

  it('pago inexistente → 404', async () => {
    repository.leerPago.mockResolvedValue(null)
    expect((await anular({ pagoId: 999, motivo: 'ERROR_CARGA' })).status).toBe(404)
  })

  it('pago ya anulado → 409 PAGO_ANULADO', async () => {
    repository.leerPago.mockResolvedValue({ ...pagoVigente, estado: 'ANULADO' })

    const res = await anular({ pagoId: 31, motivo: 'ERROR_CARGA' })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('PAGO_ANULADO')
    expect(json.error.message).toBe('Un pago anulado no se puede volver a activar')
    expect(repository.anular).not.toHaveBeenCalled()
  })
})

describe('OpenAPI', () => {
  it('declara todos los status codes de cada endpoint', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const codigos = (path: string, metodo: 'get' | 'post') =>
      Object.keys(doc.paths?.[path]?.[metodo]?.responses ?? {}).sort()

    expect(codigos('/api/v1/anulaciones/previa', 'get')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(codigos('/api/v1/anulaciones', 'post')).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })
})
