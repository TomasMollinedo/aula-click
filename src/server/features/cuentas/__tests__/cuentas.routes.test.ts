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

const RUTAS = ['/alumnos/12', '/adeudados', '/proximos']
const FECHA = /^\d{4}-\d{2}-\d{2}$/

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  alumnosRepository.buscarPorId.mockResolvedValue({ id: 12 })
  repository.leerAdeudados.mockResolvedValue([adeudado])
  repository.leerProximos.mockResolvedValue([])
  repository.dnisDeAlumnos.mockResolvedValue(new Map([[12, '52345678']]))
})

describe('auth', () => {
  it.each(RUTAS)('%s sin sesión → 401', async (path) => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir(path)).status).toBe(401)
  })

  it.each(['PROFESOR', 'GERENTE'])('con %s → 403 en los tres endpoints', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    for (const path of RUTAS) expect((await pedir(path)).status).toBe(403)
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
    expect(repository.leerProximos).not.toHaveBeenCalled()
  })
})

describe('período', () => {
  it.each(RUTAS)(
    '%s con `hasta` anterior a `desde` → 400 VALIDACION sobre `hasta`',
    async (path) => {
      const res = await pedir(`${path}?desde=2026-09-30&hasta=2026-09-01`)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error.code).toBe('VALIDACION')
      expect(json.error.details).toEqual([
        expect.objectContaining({
          path: ['hasta'],
          message: 'La fecha hasta no puede ser anterior a la fecha desde',
        }),
      ])
      expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
      expect(repository.leerAdeudados).not.toHaveBeenCalled()
      expect(repository.leerProximos).not.toHaveBeenCalled()
    },
  )

  it.each(RUTAS)('%s con `desde` igual a `hasta` o un solo extremo → 200', async (path) => {
    expect((await pedir(`${path}?desde=2026-09-01&hasta=2026-09-01`)).status).toBe(200)
    expect((await pedir(`${path}?desde=2026-09-01`)).status).toBe(200)
    expect((await pedir(`${path}?hasta=2026-09-01`)).status).toBe(200)
  })

  it.each(RUTAS)('%s sin tope de días: un período de años → 200', async (path) => {
    expect((await pedir(`${path}?desde=2020-01-01&hasta=2030-12-31`)).status).toBe(200)
  })

  it.each(RUTAS)('%s con filtros inválidos → 400 VALIDACION en el campo', async (path) => {
    for (const [query, campo] of [
      ['desde=2026-02-30', 'desde'],
      ['hasta=30-09-2026', 'hasta'],
      ['materiaId=abc', 'materiaId'],
      ['profesorId=0', 'profesorId'],
    ]) {
      const res = await pedir(`${path}?${query}`)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error.code).toBe('VALIDACION')
      expect(json.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
      )
    }
  })
})

describe('GET /cuentas/alumnos/{alumnoId}', () => {
  it('200 con la cuenta', async () => {
    const res = await pedir('/alumnos/12')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      totalAdeudado: 8000,
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
      limiteCobro: expect.stringMatching(FECHA),
    })
  })

  it('los filtros llegan como número y texto a las dos secciones', async () => {
    const res = await pedir(
      '/alumnos/12?materiaId=2&profesorId=3&desde=2020-01-01&hasta=2099-12-31',
    )

    expect(res.status).toBe(200)
    const filtro = {
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      desde: '2020-01-01',
      hasta: '2099-12-31',
    }
    expect(repository.leerAdeudados.mock.calls[0]?.[0]).toMatchObject(filtro)
    expect(repository.leerProximos.mock.calls[0]?.[0]).toMatchObject(filtro)
  })

  it('período sólo pasado → `proximos: null`; sólo futuro → `adeudados: null` y total 0', async () => {
    const pasado = await (await pedir('/alumnos/12?hasta=2020-12-31')).json()
    expect(pasado.proximos).toBeNull()
    expect(pasado.adeudados).toHaveLength(1)

    const futuro = await (await pedir('/alumnos/12?desde=2099-01-01')).json()
    expect(futuro.adeudados).toBeNull()
    expect(futuro.totalAdeudado).toBe(0)
    expect(futuro.proximos).toEqual([])
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
    expect(json.aplica).toBe(true)
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

  it('materia y profesor llegan como número', async () => {
    expect((await pedir('/adeudados?materiaId=2&profesorId=3')).status).toBe(200)
    expect(repository.leerAdeudados.mock.calls[0]?.[0]).toMatchObject({
      materiaId: 2,
      profesorId: 3,
    })
  })

  it('período sólo futuro → 200 con `aplica: false`, vacío y en 0', async () => {
    const res = await pedir('/adeudados?desde=2099-01-01')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      totalAdeudado: 0,
      aplica: false,
    })
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
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

describe('GET /cuentas/proximos', () => {
  const proximo = {
    ocurrencia: { ...adeudado.ocurrencia, fecha: '2099-01-05', estado: 'AGENDADO' },
    importe: 8000,
  }

  beforeEach(() => {
    repository.leerProximos.mockResolvedValue([proximo])
  })

  it('200 con data, meta, aplica y limiteCobro, sin total', async () => {
    const res = await pedir('/proximos?page=1&pageSize=20')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [
        {
          turnoId: 41,
          fecha: '2099-01-05',
          horaInicio: '09:00',
          horaFin: '10:00',
          materia: { id: 2, nombre: 'Matemática' },
          profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
          estado: 'AGENDADO',
          importe: 8000,
          alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      aplica: true,
      limiteCobro: expect.stringMatching(FECHA),
    })
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })

  it('con alumnoId, materia y profesor: los pasa como número', async () => {
    expect((await pedir('/proximos?alumnoId=12&materiaId=2&profesorId=3')).status).toBe(200)
    expect(repository.leerProximos.mock.calls[0]?.[0]).toMatchObject({
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
    })
  })

  it('alumnoId inexistente → 404 NO_ENCONTRADO', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    const res = await pedir('/proximos?alumnoId=99')

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
    expect(repository.leerProximos).not.toHaveBeenCalled()
  })

  it('período sólo pasado → 200 con `aplica: false` y vacío', async () => {
    const res = await pedir('/proximos?hasta=2020-12-31')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      aplica: false,
    })
    expect(json).not.toHaveProperty('totalAdeudado')
    expect(repository.leerProximos).not.toHaveBeenCalled()
  })

  it.each([
    ['pageSize=101', ['pageSize']],
    ['page=0', ['page']],
    ['alumnoId=abc', ['alumnoId']],
  ])('%s → 400 VALIDACION en el campo', async (query, path) => {
    const res = await pedir(`/proximos?${query}`)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.leerProximos).not.toHaveBeenCalled()
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
    expect(
      Object.keys(doc.paths?.['/api/v1/cuentas/proximos']?.get?.responses ?? {}).sort(),
    ).toEqual(codigos)
  })

  it('los tres endpoints declaran los filtros de período, materia y profesor en el query', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const enQuery = (path: string) =>
      (doc.paths?.[path]?.get?.parameters ?? [])
        .flatMap((p) => ('in' in p && p.in === 'query' ? [p.name] : []))
        .sort()
    const filtros = ['desde', 'hasta', 'materiaId', 'profesorId']
    const listado = ['alumnoId', ...filtros, 'page', 'pageSize'].sort()

    expect(enQuery('/api/v1/cuentas/alumnos/{alumnoId}')).toEqual(filtros)
    expect(enQuery('/api/v1/cuentas/adeudados')).toEqual(listado)
    expect(enQuery('/api/v1/cuentas/proximos')).toEqual(listado)
  })
})
