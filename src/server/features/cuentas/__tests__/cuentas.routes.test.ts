import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { cuentasRoutes } from '../cuentas.routes'

// Contrato HTTP de cuentas (T-53): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en las
// reglas, las condiciones y el service.

const { repository, alumnosRepository, getSession } = vi.hoisted(() => ({
  repository: {
    leerAdeudados: vi.fn(),
    leerProximos: vi.fn(),
    sumarPagos: vi.fn(),
    listarPagos: vi.fn(),
    dnisDeAlumnos: vi.fn(),
  },
  alumnosRepository: { buscarPorId: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../cuentas.repository', () => ({ cuentasRepository: repository }))
vi.mock('@/server/features/alumnos/alumnos.repository', () => ({ alumnosRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/cuentas', cuentasRoutes)

const adeudado = {
  ocurrencia: {
    turnoId: 41,
    fecha: '2026-09-28',
    horaInicio: 540,
    horaFin: 600,
    estado: 'SIN_REGISTRAR',
    alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', busqueda: 'alvarez lucia' },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez', busqueda: 'gomez ana' },
    materia: { id: 2, nombre: 'Matemática' },
  },
  importe: 8000,
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

const pedir = (path: string) => app.request(`/api/v1/cuentas${path}`)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  alumnosRepository.buscarPorId.mockResolvedValue({ id: 12 })
  repository.leerAdeudados.mockResolvedValue([adeudado])
  repository.leerProximos.mockResolvedValue([])
  repository.sumarPagos.mockResolvedValue(0)
  repository.listarPagos.mockResolvedValue([])
  repository.dnisDeAlumnos.mockResolvedValue(new Map([[12, '52345678']]))
})

describe('auth', () => {
  it.each(['/alumnos/12', '/adeudados'])('%s sin sesión → 401', async (path) => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir(path)).status).toBe(401)
  })

  it.each(['PROFESOR', 'GERENTE'])('con %s → 403 en los dos endpoints', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    expect((await pedir('/alumnos/12')).status).toBe(403)
    expect((await pedir('/adeudados')).status).toBe(403)
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })
})

describe('GET /cuentas/alumnos/{alumnoId}', () => {
  it('200 con la cuenta', async () => {
    const res = await pedir('/alumnos/12')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      totalAdeudado: 8000,
      pagadoDelMes: 0,
      adeudados: [
        {
          turnoId: 41,
          fecha: '2026-09-28',
          horaInicio: '09:00',
          horaFin: '10:00',
          materia: { id: 2, nombre: 'Matemática' },
          profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
          estado: 'SIN_REGISTRAR',
          importe: 8000,
        },
      ],
      proximos: [],
      pagos: [],
    })
  })

  it('alumno inexistente → 404 NO_ENCONTRADO', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/alumnos/99')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/alumnos/abc', '/alumnos/0'])('id inválido %s → 400', async (path) => {
    expect((await pedir(path)).status).toBe(400)
  })
})

describe('GET /cuentas/adeudados', () => {
  it('200 con data, meta y totalAdeudado junto a ellos', async () => {
    const res = await pedir('/adeudados?page=1&pageSize=20')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 })
    expect(json.totalAdeudado).toBe(8000)
    expect(json.data[0].alumno).toEqual({
      id: 12,
      nombre: 'Lucía',
      apellido: 'Álvarez',
      dni: '52345678',
    })
  })

  it('con alumnoId: lo pasa como número', async () => {
    expect((await pedir('/adeudados?alumnoId=12')).status).toBe(200)
    expect(repository.leerAdeudados.mock.calls[0]?.[0]).toMatchObject({ alumnoId: 12 })
  })

  it('alumnoId inexistente → 404', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    expect((await pedir('/adeudados?alumnoId=99')).status).toBe(404)
  })

  it.each([
    ['pageSize=101', ['pageSize']],
    ['page=0', ['page']],
    ['alumnoId=abc', ['alumnoId']],
    ['alumnoId=0', ['alumnoId']],
  ])('%s → 400 VALIDACION en el campo', async (query, path) => {
    const res = await pedir(`/adeudados?${query}`)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })
})

describe('OpenAPI', () => {
  it('declara todos los status codes de cada endpoint', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const codigos = ['200', '400', '401', '403', '404']
    expect(
      Object.keys(doc.paths?.['/api/v1/cuentas/alumnos/{alumnoId}']?.get?.responses ?? {}).sort(),
    ).toEqual(codigos)
    expect(
      Object.keys(doc.paths?.['/api/v1/cuentas/adeudados']?.get?.responses ?? {}).sort(),
    ).toEqual(codigos)
  })
})
