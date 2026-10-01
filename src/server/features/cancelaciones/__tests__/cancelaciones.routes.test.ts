import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { cancelacionesRoutes } from '../cancelaciones.routes'

// Contrato HTTP de cancelaciones (T-45): validación de Zod, auth y OpenAPI. Sin base ni variables
// de entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en el
// service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { leerSnapshot: vi.fn(), cancelar: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../cancelaciones.repository', () => ({ cancelacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/cancelaciones', cancelacionesRoutes)

const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta' }).format(
  new Date(),
)

const body = {
  ocurrencias: [{ turnoId: 41, fecha: HOY }],
  motivo: 'CANCELACION_ALUMNO',
  detalle: 'Viaja',
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(datos?: unknown) {
  return app.request('/api/v1/cancelaciones', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerSnapshot.mockResolvedValue([
    { turnoId: 41, fecha: HOY, alumnoId: 12, estado: 'AGENDADO', pago: { estado: 'PENDIENTE' } },
  ])
  repository.cancelar.mockImplementation(async (_entrada, verificar) =>
    verificar(await repository.leerSnapshot()),
  )
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir(body)).status).toBe(401)
  })

  it.each(['PROFESOR', 'GERENTE'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    expect((await pedir(body)).status).toBe(403)
    expect(repository.cancelar).not.toHaveBeenCalled()
  })
})

describe('POST /cancelaciones', () => {
  it('201 con la cantidad y el detalle guardado sin espacios', async () => {
    const res = await pedir({ ...body, detalle: '  Viaja  ' })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ cantidad: 1 })
    expect(repository.cancelar.mock.calls[0]?.[0]).toEqual({
      alumnoId: 12,
      ocurrencias: [{ turnoId: 41, fecha: HOY }],
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Viaja',
    })
  })

  it.each([
    ['sin ocurrencias', { ...body, ocurrencias: [] }, ['ocurrencias']],
    [
      'más de 200 ocurrencias',
      {
        ...body,
        ocurrencias: Array.from({ length: 201 }, (_, i) => ({ turnoId: i + 1, fecha: HOY })),
      },
      ['ocurrencias'],
    ],
    [
      'ocurrencia repetida',
      { ...body, ocurrencias: [body.ocurrencias[0], body.ocurrencias[0]] },
      ['ocurrencias', 1],
    ],
    [
      'fecha inválida',
      { ...body, ocurrencias: [{ turnoId: 41, fecha: '2026-02-30' }] },
      ['ocurrencias', 0, 'fecha'],
    ],
    ['motivo inválido', { ...body, motivo: 'PORQUE_SI' }, ['motivo']],
    ['sin motivo', { ...body, motivo: undefined }, ['motivo']],
    ['OTRO sin detalle', { ...body, motivo: 'OTRO', detalle: undefined }, ['detalle']],
    ['detalle de más de 500', { ...body, detalle: 'x'.repeat(501) }, ['detalle']],
  ])('%s → 400 VALIDACION en el campo', async (_, datos, path) => {
    const res = await pedir(datos)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.cancelar).not.toHaveBeenCalled()
  })

  it('una pagada → 409 TURNOS_NO_CANCELABLES con el motivo por ocurrencia', async () => {
    repository.leerSnapshot.mockResolvedValue([
      {
        turnoId: 41,
        fecha: HOY,
        alumnoId: 12,
        estado: 'AGENDADO',
        pago: { estado: 'PAGADO', pagoId: 29 },
      },
    ])

    const res = await pedir(body)

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(json.error.details).toEqual([
      {
        path: ['ocurrencias', 0],
        message: 'El turno está pagado: no se puede cancelar',
        turnoId: 41,
        fecha: HOY,
        motivo: 'PAGADO',
        pagoId: 29,
      },
    ])
  })
})

describe('OpenAPI', () => {
  it('declara todos los status codes del endpoint', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    expect(Object.keys(doc.paths?.['/api/v1/cancelaciones']?.post?.responses ?? {}).sort()).toEqual(
      ['201', '400', '401', '403', '409'],
    )
  })
})
