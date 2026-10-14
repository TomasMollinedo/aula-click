import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { asistenciasRoutes } from '../asistencias.routes'

// Contrato HTTP de asistencias (T-81): sólo el profesor, validación de Zod y forma de la respuesta.
// Sin base ni variables de entorno: los repositories, el storage y Better Auth son mocks. Las
// reglas se prueban en `asistencias.service.test.ts`.

const { repository, buscarIdPorUsuario, getSession } = vi.hoisted(() => ({
  repository: { leer: vi.fn(), ultimasIndicaciones: vi.fn(), registrar: vi.fn() },
  buscarIdPorUsuario: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('../asistencias.repository', () => ({ asistenciasRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({
  profesoresRepository: { buscarIdPorUsuario },
}))
vi.mock('@/lib/storage', () => ({ getPresignedUrl: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/asistencias', asistenciasRoutes)

function sesion(role: string) {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_1', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta' }).format(
  new Date(),
)

const pedidos = {
  'GET /asistencias': () => app.request('/api/v1/asistencias'),
  'GET /asistencias/pendientes': () => app.request('/api/v1/asistencias/pendientes'),
  'PUT /asistencias': () =>
    app.request('/api/v1/asistencias', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        registros: [{ ocurrencias: [{ turnoId: 1, fecha: HOY }], estado: 'PRESENTE' }],
      }),
    }),
}

beforeEach(() => {
  vi.clearAllMocks()
  buscarIdPorUsuario.mockResolvedValue(5)
  repository.leer.mockResolvedValue([])
  repository.ultimasIndicaciones.mockResolvedValue([])
})

describe('roles', () => {
  for (const role of ['MESA_ENTRADAS', 'GERENTE']) {
    it.each(Object.entries(pedidos))(`${role}: %s → 403 SIN_PERMISO`, async (_nombre, pedir) => {
      getSession.mockResolvedValue(sesion(role))

      const res = await pedir()

      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('SIN_PERMISO')
      expect(repository.leer).not.toHaveBeenCalled()
      expect(repository.registrar).not.toHaveBeenCalled()
    })
  }

  it('PROFESOR: GET /asistencias → 200 con la forma del día', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await pedidos['GET /asistencias']()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ fecha: HOY, editable: true, clases: [] })
  })

  it('PROFESOR: GET /asistencias/pendientes → 200', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await pedidos['GET /asistencias/pendientes']()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cantidad: 0, masAntiguo: null })
  })
})

describe('PUT /asistencias (validación)', () => {
  it('ausente con trabajado → 400 VALIDACION en ese campo', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await app.request('/api/v1/asistencias', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        registros: [
          { ocurrencias: [{ turnoId: 1, fecha: HOY }], estado: 'AUSENTE', trabajado: 'x' },
        ],
      }),
    })

    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDACION')
    expect(error.details).toEqual([
      expect.objectContaining({ path: ['registros', 0, 'trabajado'] }),
    ])
  })

  it('GET con fecha inválida → 400', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    expect((await app.request('/api/v1/asistencias?fecha=2026-02-30')).status).toBe(400)
  })
})
