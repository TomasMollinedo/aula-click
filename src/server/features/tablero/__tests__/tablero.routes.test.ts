import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
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
    totalCobradoPorForma: vi.fn(),
    totalAdeudado: vi.fn(),
    cobrosConReparto: vi.fn(),
    saldosDeProfesores: vi.fn(),
    liquidacionesPagadas: vi.fn(),
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
  alumnoId: 12,
  estado: 'SIN_REGISTRAR',
  plazoAsistencia: { vence: '2020-01-13', vencido: true },
  materia: { id: 2, nombre: 'Matemática' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez', busqueda: 'gomez ana' },
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
  repository.totalCobradoPorForma.mockResolvedValue({
    EFECTIVO: 10000,
    TRANSFERENCIA: 6000,
    DEBITO: 0,
  })
  repository.totalAdeudado.mockResolvedValue(48000.5)
  repository.cobrosConReparto.mockResolvedValue([])
  repository.saldosDeProfesores.mockResolvedValue([])
  repository.liquidacionesPagadas.mockResolvedValue([])
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
        asistio: { cantidad: 0, porcentaje: 0 },
        noAsistio: { cantidad: 0, porcentaje: 0 },
      },
      ocupacion: { turnos: 1, capacidad: 4, porcentaje: 25 },
      alumnos: { nuevos: 2, atendidos: 0 },
      materiasConMasDemanda: [{ materia: { id: 2, nombre: 'Matemática' }, cantidad: 1 }],
      profesoresConMasTurnos: [
        { profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' }, cantidad: 1 },
      ],
      pagos: {
        totalCobrado: 16000,
        cobradoPorForma: { EFECTIVO: 10000, TRANSFERENCIA: 6000, DEBITO: 0 },
        totalAdeudado: 48000.5,
      },
    })
  })

  it('el período llega tal cual a las lecturas', async () => {
    await pedir()

    const periodo = { desde: '2020-01-06', hasta: '2020-01-12' }
    expect(repository.ocurrenciasDelPeriodo.mock.calls[0]?.[0]).toEqual(periodo)
    expect(repository.totalCobrado).toHaveBeenCalledExactlyOnceWith(periodo)
    expect(repository.totalCobradoPorForma).toHaveBeenCalledExactlyOnceWith(periodo)
  })

  it('con asistencia registrada, asistió, no asistió y atendidos tienen valor', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      { ...ocurrencia, turnoId: 51, estado: 'REALIZADO', alumnoId: 12 },
      { ...ocurrencia, turnoId: 52, estado: 'REALIZADO', alumnoId: 13 },
      { ...ocurrencia, turnoId: 53, estado: 'AUSENTE', alumnoId: 14 },
    ])
    const json = await (await pedir()).json()

    expect(json.turnos.asistio).toEqual({ cantidad: 2, porcentaje: 66.7 })
    expect(json.turnos.noAsistio).toEqual({ cantidad: 1, porcentaje: 33.3 })
    expect(json.alumnos.atendidos).toBe(2)
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

  it('ya no hay indicadores "no disponibles": asistió y no asistió son conteos', () => {
    expect(doc.components?.schemas?.IndicadorNoDisponible).toBeUndefined()
    expect(doc.components?.schemas?.TableroConteoAsistencia).toMatchObject({
      type: 'object',
      required: ['cantidad', 'porcentaje'],
    })
  })
})

describe('GET /tablero/asistencia', () => {
  const pedirAsistencia = (query = '?desde=2020-01-06&hasta=2020-01-12') =>
    app.request(`/api/v1/tablero/asistencia${query}`)

  const PERIODO = { desde: '2020-01-06', hasta: '2020-01-12' }

  beforeEach(() => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      { ...ocurrencia, turnoId: 61, estado: 'REALIZADO' },
      { ...ocurrencia, turnoId: 62, estado: 'AUSENTE', alumnoId: 13 },
      { ...ocurrencia, turnoId: 63 },
      { ...ocurrencia, turnoId: 64, estado: 'CANCELADO' },
    ])
  })

  it('sin sesión → 401 NO_AUTENTICADO', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedirAsistencia()

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
    ningunaLectura()
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403 SIN_PERMISO', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedirAsistencia()

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    ningunaLectura()
  })

  it('con GERENTE → 200 con el resumen y las dos tablas, con sus defaults', async () => {
    const res = await pedirAsistencia()

    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({
      periodo: PERIODO,
      hoy: expect.stringMatching(FECHA),
      resumen: {
        porcentajeAsistencia: 50,
        cerradosSinRegistrar: 1,
        profesoresSinRegistrar: 1,
        alumnosBajoElUmbral: 1,
      },
      profesores: {
        data: [
          {
            profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
            clasesRealizadas: 1,
            ausencias: 1,
            porcentajeAsistencia: 50,
            cerradosSinRegistrar: 1,
            dentroDelPlazo: 0,
            porcentajeSinRegistrar: 33.3,
            noRegistraAsistencia: true,
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      materias: {
        data: [
          {
            materia: { id: 2, nombre: 'Matemática' },
            clasesRealizadas: 1,
            ausencias: 1,
            porcentajeAsistencia: 50,
            cerradosSinRegistrar: 1,
            dentroDelPlazo: 0,
            porcentajeSinRegistrar: 33.3,
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    })
  })

  it('lee las ocurrencias una sola vez, con el período tal cual, y no pide nada más', async () => {
    await pedirAsistencia()

    expect(repository.ocurrenciasDelPeriodo).toHaveBeenCalledTimes(1)
    expect(repository.ocurrenciasDelPeriodo.mock.calls[0]?.[0]).toEqual(PERIODO)
    expect(repository.totalCobrado).not.toHaveBeenCalled()
    expect(repository.totalAdeudado).not.toHaveBeenCalled()
  })

  it('`soloSinRegistrar`, `orden` y `direccion` se aceptan', async () => {
    const res = await pedirAsistencia(
      '?desde=2020-01-06&hasta=2020-01-12&soloSinRegistrar=true&orden=profesor&direccion=asc',
    )

    expect(res.status).toBe(200)
    expect((await res.json()).profesores.data).toHaveLength(1)
  })

  it('`soloSinRegistrar=true` sin ningún profesor que no registre → tabla vacía', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([{ ...ocurrencia, estado: 'REALIZADO' }])
    const json = await (
      await pedirAsistencia('?desde=2020-01-06&hasta=2020-01-12&soloSinRegistrar=true')
    ).json()

    expect(json.profesores).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    })
    expect(json.materias.data).toHaveLength(1)
  })

  it('un solo día y 366 días → 200', async () => {
    expect((await pedirAsistencia('?desde=2020-01-06&hasta=2020-01-06')).status).toBe(200)
    expect((await pedirAsistencia('?desde=2028-01-01&hasta=2028-12-31')).status).toBe(200)
  })

  const BASE = '?desde=2020-01-06&hasta=2020-01-12'
  it.each([
    ['sin `desde`', '?hasta=2020-01-12', 'desde'],
    ['sin `hasta`', '?desde=2020-01-06', 'hasta'],
    ['`hasta` anterior a `desde`', '?desde=2020-01-12&hasta=2020-01-06', 'hasta'],
    ['más de 366 días', '?desde=2028-01-01&hasta=2029-01-01', 'hasta'],
    ['página de profesores en 0', `${BASE}&paginaProfesores=0`, 'paginaProfesores'],
    ['página de materias decimal', `${BASE}&paginaMaterias=1.5`, 'paginaMaterias'],
    ['página que no es un número', `${BASE}&paginaProfesores=x`, 'paginaProfesores'],
    ['columna que no existe', `${BASE}&orden=alumno`, 'orden'],
    ['dirección que no existe', `${BASE}&direccion=arriba`, 'direccion'],
    ['`soloSinRegistrar` que no es booleano', `${BASE}&soloSinRegistrar=si`, 'soloSinRegistrar'],
  ])('%s → 400 VALIDACION sobre el campo', async (_caso, query, campo) => {
    const res = await pedirAsistencia(query)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
    )
    ningunaLectura()
  })

  it('OpenAPI: declara sus status codes, los parámetros y los componentes de la respuesta', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const get = doc.paths?.['/api/v1/tablero/asistencia']?.get

    expect(Object.keys(get?.responses ?? {}).sort()).toEqual(['200', '400', '401', '403'])
    for (const codigo of ['400', '401', '403']) {
      const respuesta = get?.responses?.[codigo]
      const contenido = respuesta && 'content' in respuesta ? respuesta.content : undefined
      expect(contenido?.['application/json']?.example).toBeDefined()
    }
    const parametros = (get?.parameters ?? []).flatMap((p) =>
      'in' in p && p.in === 'query' ? [{ name: p.name, required: p.required }] : [],
    )
    expect(parametros).toEqual([
      { name: 'desde', required: true },
      { name: 'hasta', required: true },
      { name: 'paginaProfesores', required: false },
      { name: 'paginaMaterias', required: false },
      { name: 'orden', required: false },
      { name: 'direccion', required: false },
      { name: 'soloSinRegistrar', required: false },
    ])
    for (const nombre of ['TableroAsistenciaProfesor', 'TableroAsistenciaMateria']) {
      expect(doc.components?.schemas?.[nombre]).toBeDefined()
    }
  })
})

describe('GET /tablero/pdf', { timeout: 30_000 }, () => {
  const pedirPdf = (query = '?desde=2020-01-06&hasta=2020-01-12') =>
    app.request(`/api/v1/tablero/pdf${query}`)

  it('con GERENTE → 200 con el PDF y los headers del contrato común', async () => {
    const res = await pedirPdf()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="tablero-2020-01-06_2020-01-12.pdf"; filename*=UTF-8''tablero-2020-01-06_2020-01-12.pdf`,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    // 06/01/2020 es lunes y 12/01/2020, domingo.
    expect(metadato(pdf, 'Title')).toBe('Tablero semanal')
  })

  it('el período llega tal cual a las lecturas, igual que en el JSON', async () => {
    await pedirPdf()

    const periodo = { desde: '2020-01-06', hasta: '2020-01-12' }
    expect(repository.ocurrenciasDelPeriodo.mock.calls[0]?.[0]).toEqual(periodo)
    expect(repository.totalCobrado).toHaveBeenCalledExactlyOnceWith(periodo)
  })

  it('`seccion=general` es lo mismo que sin `seccion`: mismo archivo y mismo título', async () => {
    const res = await pedirPdf('?desde=2020-01-06&hasta=2020-01-12&seccion=general')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('tablero-2020-01-06_2020-01-12.pdf')
    expect(metadato(Buffer.from(await res.arrayBuffer()), 'Title')).toBe('Tablero semanal')
    expect(repository.totalCobradoPorForma).toHaveBeenCalledTimes(1)
  })

  it('`seccion=asistencia` → el PDF de asistencia, con su archivo y sin pedir lo del dinero', async () => {
    const res = await pedirPdf('?desde=2020-01-06&hasta=2020-01-12&seccion=asistencia')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="tablero-asistencia-2020-01-06_2020-01-12.pdf"; filename*=UTF-8''tablero-asistencia-2020-01-06_2020-01-12.pdf`,
    )
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(metadato(pdf, 'Title')).toBe('Asistencia semanal')
    expect(repository.ocurrenciasDelPeriodo).toHaveBeenCalledTimes(1)
    expect(repository.totalCobrado).not.toHaveBeenCalled()
    expect(repository.totalCobradoPorForma).not.toHaveBeenCalled()
  })

  it('`seccion` que no existe → 400 JSON sobre `seccion`, sin lecturas', async () => {
    const res = await pedirPdf('?desde=2020-01-06&hasta=2020-01-12&seccion=pagos')

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['seccion'] })]),
    )
    ningunaLectura()
  })

  it('sin sesión → 401 JSON, sin lecturas', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedirPdf()

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
    ningunaLectura()
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403 JSON', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedirPdf()

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    ningunaLectura()
  })

  it.each([
    ['sin `desde`', '?hasta=2020-01-12', 'desde'],
    ['sin `hasta`', '?desde=2020-01-06', 'hasta'],
    ['`hasta` anterior a `desde`', '?desde=2020-01-12&hasta=2020-01-06', 'hasta'],
    ['más de 366 días', '?desde=2028-01-01&hasta=2029-01-01', 'hasta'],
  ])('%s → 400 JSON sobre el campo', async (_caso, query, campo) => {
    const res = await pedirPdf(query)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
    )
    ningunaLectura()
  })

  it('el OpenAPI declara el 200 como application/pdf binario y los errores como JSON', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const get = doc.paths?.['/api/v1/tablero/pdf']?.get

    expect(Object.keys(get?.responses ?? {}).sort()).toEqual(['200', '400', '401', '403'])
    const ok = get?.responses?.['200']
    const contenido = ok && 'content' in ok ? ok.content : undefined
    expect(contenido?.['application/pdf']?.schema).toMatchObject({
      type: 'string',
      format: 'binary',
    })
    for (const codigo of ['400', '401', '403']) {
      const respuesta = get?.responses?.[codigo]
      const json = respuesta && 'content' in respuesta ? respuesta.content : undefined
      expect(json?.['application/json']?.example).toBeDefined()
    }
  })

  it('`seccion=finanzas` → el PDF de finanzas, con su archivo y sin pedir las ocurrencias', async () => {
    const res = await pedirPdf('?desde=2020-01-06&hasta=2020-01-12&seccion=finanzas')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="tablero-finanzas-2020-01-06_2020-01-12.pdf"; filename*=UTF-8''tablero-finanzas-2020-01-06_2020-01-12.pdf`,
    )
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(metadato(pdf, 'Title')).toBe('Finanzas semanal')
    const periodo = { desde: '2020-01-06', hasta: '2020-01-12' }
    expect(repository.totalCobrado).toHaveBeenCalledExactlyOnceWith(periodo)
    expect(repository.cobrosConReparto).toHaveBeenCalledTimes(1)
    expect(repository.liquidacionesPagadas).toHaveBeenCalledTimes(1)
    expect(repository.saldosDeProfesores).toHaveBeenCalledTimes(1)
    expect(repository.ocurrenciasDelPeriodo).not.toHaveBeenCalled()
  })
})

describe('GET /tablero/finanzas', () => {
  const pedirFinanzas = (query = '?desde=2020-01-06&hasta=2020-01-12') =>
    app.request(`/api/v1/tablero/finanzas${query}`)

  const PERIODO = { desde: '2020-01-06', hasta: '2020-01-12' }
  const ANA = { id: 3, nombre: 'Ana', apellido: 'Gómez' }
  const LUIS = { id: 5, nombre: 'Luis', apellido: 'Pérez' }
  const cobro = {
    pagoTurnoId: 1,
    pagoId: 1,
    numeroComprobante: 1,
    fechaPago: '2020-01-07',
    fechaOcurrencia: '2020-01-07',
    profesor: ANA,
    reparto: { importe: 8000, porcentaje: 15, parteCentro: 1200, parteProfesor: 6800 },
    cerradaSinRegistrar: false,
  }

  beforeEach(() => {
    repository.totalCobrado.mockResolvedValue(12000)
    repository.cobrosConReparto.mockResolvedValue([
      cobro,
      {
        ...cobro,
        pagoTurnoId: 2,
        reparto: { importe: 4000, porcentaje: 15, parteCentro: 600, parteProfesor: 3400 },
        cerradaSinRegistrar: true,
      },
    ])
    repository.liquidacionesPagadas.mockResolvedValue([
      { profesor: ANA, fechaTransferencia: '2020-01-08', total: 6800 },
    ])
    repository.saldosDeProfesores.mockResolvedValue([
      { profesor: ANA, saldo: 3400 },
      { profesor: LUIS, saldo: -1200 },
    ])
  })

  it('sin sesión → 401 NO_AUTENTICADO, sin lecturas', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedirFinanzas()

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
    ningunaLectura()
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403 SIN_PERMISO', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedirFinanzas()

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    ningunaLectura()
  })

  it('con GERENTE → 200 con el resumen, la tabla y la evolución, con sus defaults', async () => {
    const res = await pedirFinanzas()

    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({
      periodo: PERIODO,
      hoy: expect.stringMatching(FECHA),
      resumen: {
        totalCobrado: 12000,
        margenCentro: { importe: 5200, porcentaje: 43.3 },
        incluyeSinRegistrar: 4000,
        pagadoAProfesores: 6800,
        saldoAPagarAProfesores: 3400,
      },
      profesores: {
        data: [
          {
            profesor: ANA,
            turnosCobrados: 2,
            totalCobrado: 12000,
            parteCentro: 5200,
            parteProfesor: 6800,
            pagado: 6800,
            saldoPendiente: 3400,
          },
          {
            profesor: LUIS,
            turnosCobrados: 0,
            totalCobrado: 0,
            parteCentro: 0,
            parteProfesor: 0,
            pagado: 0,
            saldoPendiente: -1200,
          },
        ],
        meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
      },
      evolucion: [
        { mes: '2019-08', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
        { mes: '2019-09', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
        { mes: '2019-10', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
        { mes: '2019-11', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
        { mes: '2019-12', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
        { mes: '2020-01', totalCobrado: 12000, margenCentro: 5200, pagadoAProfesores: 6800 },
      ],
    })
  })

  it('el total cobrado es el mismo que el de `GET /tablero` para el período', async () => {
    const finanzas = await (await pedirFinanzas()).json()
    const general = await (await pedir()).json()

    expect(finanzas.resumen.totalCobrado).toBe(general.pagos.totalCobrado)
    expect(repository.totalCobrado).toHaveBeenNthCalledWith(1, PERIODO)
    expect(repository.totalCobrado).toHaveBeenNthCalledWith(2, PERIODO)
  })

  it('`orden`, `direccion` y `page` se aceptan', async () => {
    const res = await pedirFinanzas(
      '?desde=2020-01-06&hasta=2020-01-12&orden=saldoPendiente&direccion=asc&page=1',
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profesores.data.map((f: { profesor: { id: number } }) => f.profesor.id)).toEqual([
      5, 3,
    ])
  })

  it('un solo día y 366 días → 200', async () => {
    expect((await pedirFinanzas('?desde=2020-01-06&hasta=2020-01-06')).status).toBe(200)
    expect((await pedirFinanzas('?desde=2028-01-01&hasta=2028-12-31')).status).toBe(200)
  })

  const BASE = '?desde=2020-01-06&hasta=2020-01-12'
  it.each([
    ['sin `desde`', '?hasta=2020-01-12', 'desde'],
    ['sin `hasta`', '?desde=2020-01-06', 'hasta'],
    ['`hasta` anterior a `desde`', '?desde=2020-01-12&hasta=2020-01-06', 'hasta'],
    ['más de 366 días', '?desde=2028-01-01&hasta=2029-01-01', 'hasta'],
    ['página en 0', `${BASE}&page=0`, 'page'],
    ['página decimal', `${BASE}&page=1.5`, 'page'],
    ['página que no es un número', `${BASE}&page=x`, 'page'],
    ['columna que no existe', `${BASE}&orden=cerradosSinRegistrar`, 'orden'],
    ['dirección que no existe', `${BASE}&direccion=arriba`, 'direccion'],
  ])('%s → 400 VALIDACION sobre el campo', async (_caso, query, campo) => {
    const res = await pedirFinanzas(query)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [campo] })]),
    )
    ningunaLectura()
  })

  it('OpenAPI: declara sus status codes, los parámetros y los componentes de la respuesta', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const get = doc.paths?.['/api/v1/tablero/finanzas']?.get

    expect(Object.keys(get?.responses ?? {}).sort()).toEqual(['200', '400', '401', '403'])
    for (const codigo of ['400', '401', '403']) {
      const respuesta = get?.responses?.[codigo]
      const contenido = respuesta && 'content' in respuesta ? respuesta.content : undefined
      expect(contenido?.['application/json']?.example).toBeDefined()
    }
    const parametros = (get?.parameters ?? []).flatMap((p) =>
      'in' in p && p.in === 'query' ? [{ name: p.name, required: p.required }] : [],
    )
    expect(parametros).toEqual([
      { name: 'desde', required: true },
      { name: 'hasta', required: true },
      { name: 'page', required: false },
      { name: 'orden', required: false },
      { name: 'direccion', required: false },
    ])
    for (const nombre of ['TableroFinanzas', 'TableroFinanzasProfesor', 'TableroFinanzasMes']) {
      expect(doc.components?.schemas?.[nombre]).toBeDefined()
    }
  })
})
