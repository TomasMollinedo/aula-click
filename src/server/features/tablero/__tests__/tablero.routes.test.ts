import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { tableroRoutes } from '../tablero.routes'

// Contrato HTTP del tablero (T-61): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: el repository y Better Auth se reemplazan por mocks. Las cuentas se prueban en las
// reglas y en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    ocurrenciasDelPeriodo: vi.fn(),
    capacidadesDeBloques: vi.fn(),
    contarAlumnosNuevos: vi.fn(),
    totalCobrado: vi.fn(),
    totalAdeudado: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../tablero.repository', () => ({ tableroRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/tablero', tableroRoutes)

function sesion(role = 'GERENTE') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_gerente', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

const pedir = (query = '?desde=2020-01-06&hasta=2020-01-12') =>
  app.request(`/api/v1/tablero${query}`)

const FECHA = /^\d{4}-\d{2}-\d{2}$/

const ocurrencia = {
  turnoId: 41,
  fecha: '2020-01-06',
  bloqueAgendaId: 10,
  estado: 'SIN_REGISTRAR',
  materia: { id: 2, nombre: 'Matemática' },
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.ocurrenciasDelPeriodo.mockResolvedValue([
    ocurrencia,
    { ...ocurrencia, turnoId: 42, estado: 'CANCELADO' },
  ])
  repository.capacidadesDeBloques.mockResolvedValue(new Map([[10, 4]]))
  repository.contarAlumnosNuevos.mockResolvedValue(2)
  repository.totalCobrado.mockResolvedValue(16000)
  repository.totalAdeudado.mockResolvedValue(48000.5)
})

function ningunaLectura() {
  for (const lectura of Object.values(repository)) expect(lectura).not.toHaveBeenCalled()
}

describe('auth', () => {
  it('sin sesión → 401 NO_AUTENTICADO', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedir()

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
    ningunaLectura()
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403 SIN_PERMISO', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedir()

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    ningunaLectura()
  })
})

describe('GET /tablero', () => {
  it('con GERENTE → 200 con los agregados del período', async () => {
    const res = await pedir()

    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({
      periodo: { desde: '2020-01-06', hasta: '2020-01-12' },
      hoy: expect.stringMatching(FECHA),
      turnos: {
        total: 2,
        cancelados: { cantidad: 1, porcentaje: 50 },
        sinRegistrar: { cantidad: 1, porcentaje: 50 },
        agendados: null,
        asistio: { disponible: false },
        noAsistio: { disponible: false },
      },
      ocupacion: { turnos: 1, capacidad: 4, porcentaje: 25 },
      alumnos: { nuevos: 2, atendidos: { disponible: false } },
      materiasConMasDemanda: [{ materia: { id: 2, nombre: 'Matemática' }, cantidad: 1 }],
      profesoresConMasActividad: { disponible: false },
      pagos: { totalCobrado: 16000, totalAdeudado: 48000.5 },
    })
  })

  it('el período llega tal cual a las lecturas', async () => {
    await pedir()

    const periodo = { desde: '2020-01-06', hasta: '2020-01-12' }
    expect(repository.ocurrenciasDelPeriodo.mock.calls[0]?.[0]).toEqual(periodo)
    expect(repository.totalCobrado).toHaveBeenCalledExactlyOnceWith(periodo)
  })

  it('período futuro → `agendados` con cantidad, no `null`', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([{ ...ocurrencia, estado: 'AGENDADO' }])
    const json = await (await pedir('?desde=2099-01-05&hasta=2099-01-11')).json()

    expect(json.turnos.agendados).toEqual({ cantidad: 1, porcentaje: 100 })
  })

  it('un solo día y 366 días → 200', async () => {
    expect((await pedir('?desde=2020-01-06&hasta=2020-01-06')).status).toBe(200)
    expect((await pedir('?desde=2028-01-01&hasta=2028-12-31')).status).toBe(200)
  })
})

describe('período inválido → 400 VALIDACION', () => {
  it.each([
    ['sin `desde`', '?hasta=2020-01-12', 'desde'],
    ['sin `hasta`', '?desde=2020-01-06', 'hasta'],
    ['fecha inexistente', '?desde=2020-02-30&hasta=2020-03-05', 'desde'],
    ['fecha con otro formato', '?desde=2020-01-06&hasta=12-01-2020', 'hasta'],
  ])('%s → en el campo', async (_caso, query, campo) => {
    const res = await pedir(query)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
    )
    ningunaLectura()
  })

  it('sin ninguno de los dos → un detalle por campo', async () => {
    const res = await pedir('')

    expect(res.status).toBe(400)
    const paths = (await res.json()).error.details.map((d: { path: string[] }) => d.path[0])
    expect(paths.sort()).toEqual(['desde', 'hasta'])
  })

  it('`hasta` anterior a `desde` → sobre `hasta`', async () => {
    const res = await pedir('?desde=2020-01-12&hasta=2020-01-06')

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual([
      expect.objectContaining({
        path: ['hasta'],
        message: 'La fecha hasta no puede ser anterior a la fecha desde',
      }),
    ])
    ningunaLectura()
  })

  it('más de 366 días → sobre `hasta`', async () => {
    const res = await pedir('?desde=2028-01-01&hasta=2029-01-01')

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual([
      expect.objectContaining({
        path: ['hasta'],
        message: 'El período no puede superar los 366 días',
      }),
    ])
    ningunaLectura()
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
  const get = doc.paths?.['/api/v1/tablero']?.get

  it('declara todos sus status codes, cada error con un ejemplo', () => {
    expect(Object.keys(get?.responses ?? {}).sort()).toEqual(['200', '400', '401', '403'])
    for (const codigo of ['400', '401', '403']) {
      const respuesta = get?.responses?.[codigo]
      const contenido = respuesta && 'content' in respuesta ? respuesta.content : undefined
      expect(contenido?.['application/json']?.example).toBeDefined()
    }
  })

  it('`desde` y `hasta` son obligatorios en el query', () => {
    const parametros = (get?.parameters ?? []).flatMap((p) =>
      'in' in p && p.in === 'query' ? [{ name: p.name, required: p.required }] : [],
    )

    expect(parametros).toEqual([
      { name: 'desde', required: true },
      { name: 'hasta', required: true },
    ])
  })

  it('el indicador no disponible sólo admite `{ disponible: false }`', () => {
    const schema = doc.components?.schemas?.IndicadorNoDisponible

    expect(schema).toMatchObject({
      type: 'object',
      required: ['disponible'],
      additionalProperties: false,
    })
  })
})
