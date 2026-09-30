import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { reprogramacionesRoutes } from '../reprogramaciones.routes'

// Contrato HTTP de reprogramaciones (T-49): validación de Zod, auth y OpenAPI. Sin base ni
// variables de entorno: los repositories y Better Auth se reemplazan por mocks. Las reglas se
// prueban en el service.

const { repository, turnosRepository, bloquesRepository, getSession } = vi.hoisted(() => ({
  repository: { reprogramar: vi.fn() },
  turnosRepository: { buscarDetalle: vi.fn() },
  bloquesRepository: { buscarPorIds: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../reprogramaciones.repository', () => ({ reprogramacionesRepository: repository }))
vi.mock('@/server/features/turnos/turnos.repository', () => ({ turnosRepository }))
vi.mock('@/server/features/bloques/bloques.repository', () => ({ bloquesRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/reprogramaciones', reprogramacionesRoutes)

const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta' }).format(
  new Date(),
)

const body = { turnoId: 41, fecha: HOY, bloqueAgendaDestinoId: 18, fechaDestino: HOY }

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function post(datos: unknown) {
  return app.request('/api/v1/reprogramaciones', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  turnosRepository.buscarDetalle.mockResolvedValue({ id: 41, alumno: { id: 12 }, bloqueId: 10 })
  bloquesRepository.buscarPorIds.mockResolvedValue([{ id: 18, profesorId: 7 }])
  repository.reprogramar.mockResolvedValue({ turnoId: 58, cambio: 'Del lunes al jueves' })
})

describe('POST /reprogramaciones', () => {
  it('200 con { turnoId, cambio }', async () => {
    const res = await post(body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ turnoId: 58, cambio: 'Del lunes al jueves' })
    expect(repository.reprogramar).toHaveBeenCalledWith(
      {
        turnoId: 41,
        fecha: HOY,
        alumnoId: 12,
        bloqueOrigenId: 10,
        bloqueDestinoId: 18,
        profesorDestinoId: 7,
        fechaDestino: HOY,
      },
      expect.any(Function),
      expect.objectContaining({ role: 'MESA_ENTRADAS' }),
      undefined,
    )
  })

  it('400 con el path del campo si el body es inválido', async () => {
    const res = await post({ ...body, fechaDestino: '2026-02-30', turnoId: 0 })

    expect(res.status).toBe(400)
    expect(repository.reprogramar).not.toHaveBeenCalled()
  })

  it('401 sin sesión', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })

    expect((await post(body)).status).toBe(401)
  })

  it('403 para otro rol', async () => {
    for (const role of ['PROFESOR', 'GERENTE']) {
      getSession.mockResolvedValue(sesion(role))
      expect((await post(body)).status).toBe(403)
    }
    expect(repository.reprogramar).not.toHaveBeenCalled()
  })

  it('404 si el turno no existe', async () => {
    turnosRepository.buscarDetalle.mockResolvedValue(null)

    expect((await post(body)).status).toBe(404)
  })

  it('declara todos los status codes en el OpenAPI', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })

    expect(
      Object.keys(doc.paths?.['/api/v1/reprogramaciones']?.post?.responses ?? {}).sort(),
    ).toEqual(['200', '400', '401', '403', '404', '409'])
  })
})
