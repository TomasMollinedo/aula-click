import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { ejemploDetalle } from '../turnos.ejemplos'
import { turnosRoutes } from '../turnos.routes'
import type { PlanReserva, SnapshotReserva } from '../turnos.validation'

// Contrato HTTP de turnos: validación de Zod, auth y OpenAPI. Sin base ni variables de entorno:
// los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const {
  repository,
  alumnosRepository,
  bloquesRepository,
  profesoresRepository,
  materiasRepository,
  getSession,
} = vi.hoisted(() => ({
  repository: {
    contarOcupacionPorBloque: vi.fn(),
    reservar: vi.fn(),
    buscarDetalle: vi.fn(),
    listarAgenda: vi.fn(),
    listarMateriasConTurno: vi.fn(),
    listarAulasConTurno: vi.fn(),
  },
  alumnosRepository: { buscarPorId: vi.fn() },
  bloquesRepository: { buscarPorIds: vi.fn(), listarActivasDeProfesores: vi.fn() },
  profesoresRepository: {
    listarProfesoresActivosDeMateria: vi.fn(),
    buscarConAsignaciones: vi.fn(),
  },
  materiasRepository: { buscarPorIds: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../turnos.repository', () => ({ turnosRepository: repository }))
vi.mock('@/server/features/alumnos/alumnos.repository', () => ({ alumnosRepository }))
vi.mock('@/server/features/bloques/bloques.repository', () => ({ bloquesRepository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/server/features/materias/materias.repository', () => ({ materiasRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/turnos', turnosRoutes)

// Un lunes lejano: el reloj real del service no lo vuelve pasado.
const LUNES = '2099-01-05'
const BODY = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [10],
  tipo: 'SESION_UNICA',
  fechaInicio: LUNES,
}

const paginaVacia = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

function pedirAgenda(query = '') {
  return app.request(`/api/v1/turnos/agenda${query}`)
}

function pedirMaterias(query = '') {
  return app.request(`/api/v1/turnos/materias${query}`)
}

function pedirAulas(query = '') {
  return app.request(`/api/v1/turnos/aulas${query}`)
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function pedir(path: string, metodo = 'GET', body?: unknown) {
  return app.request(`/api/v1/turnos${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function issues(res: Response) {
  const body = (await res.json()) as { error: { code: string; details: { path: unknown[] }[] } }
  expect(body.error.code).toBe('VALIDACION')
  return body.error.details.map((issue) => issue.path)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  materiasRepository.buscarPorIds.mockResolvedValue([
    { id: 3, nombre: 'Matemática', estado: 'ACTIVO' },
  ])
  profesoresRepository.listarProfesoresActivosDeMateria.mockResolvedValue([
    { id: 4, apellido: 'Pérez', nombre: 'Ana', estado: 'ACTIVO' },
  ])
  bloquesRepository.listarActivasDeProfesores.mockResolvedValue([])
  repository.contarOcupacionPorBloque.mockResolvedValue([])
  alumnosRepository.buscarPorId.mockResolvedValue({ id: 12 })
  bloquesRepository.buscarPorIds.mockResolvedValue([
    {
      id: 10,
      profesorId: 4,
      aulaId: 3,
      diaSemana: 1,
      horaInicio: 540,
      horaFin: 600,
      estado: 'ACTIVO',
    },
  ])
  profesoresRepository.buscarConAsignaciones.mockResolvedValue({
    estado: 'ACTIVO',
    asignaciones: [{ materiaId: 3, nombre: 'Matemática', estado: 'ACTIVO' }],
  })
  repository.reservar.mockResolvedValue({ turnos: [ejemploDetalle], fechasSinTurno: [] })
  repository.listarAgenda.mockResolvedValue(paginaVacia)
  repository.listarMateriasConTurno.mockResolvedValue([])
  repository.listarAulasConTurno.mockResolvedValue([])
})

describe('auth', () => {
  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/disponibilidad?materiaId=3')).status).toBe(401)
    expect((await pedir('', 'POST', BODY)).status).toBe(401)
    expect((await pedir('/55')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/disponibilidad?materiaId=3')).status).toBe(403)
    expect((await pedir('', 'POST', BODY)).status).toBe(403)
    expect((await pedir('/55')).status).toBe(403)
    expect(repository.reservar).not.toHaveBeenCalled()
  })
})

describe('GET /turnos/disponibilidad', () => {
  it('200 con un arreglo (no la toma como /{turnoId})', async () => {
    const res = await pedir('/disponibilidad?materiaId=3&diaSemana=1&profesorId=4')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [4],
      diaSemana: 1,
    })
  })

  it('query inválido → 400 en cada campo', async () => {
    expect(await issues(await pedir('/disponibilidad'))).toEqual([['materiaId']])
    expect(await issues(await pedir('/disponibilidad?materiaId=0'))).toEqual([['materiaId']])
    expect(await issues(await pedir('/disponibilidad?materiaId=3&diaSemana=8'))).toEqual([
      ['diaSemana'],
    ])
    expect(await issues(await pedir('/disponibilidad?materiaId=3&profesorId=x'))).toEqual([
      ['profesorId'],
    ])
    expect(await issues(await pedir('/disponibilidad?materiaId=3&fecha=2099-02-30'))).toEqual([
      ['fecha'],
    ])
  })
})

describe('POST /turnos', () => {
  it('201 con cantidad, turnos y fechasSinTurno', async () => {
    const res = await pedir('', 'POST', BODY)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ cantidad: 1, turnos: [ejemploDetalle], fechasSinTurno: [] })
  })

  it('normaliza el body: bandera en false por defecto y motivo vacío como null', async () => {
    await pedir('', 'POST', { ...BODY, motivoConsulta: '   ' })

    const [entrada, planificar] = repository.reservar.mock.calls[0] as [
      unknown,
      (snapshot: SnapshotReserva) => PlanReserva,
    ]
    expect(entrada).toEqual({
      alumnoId: 12,
      profesorId: 4,
      materiaId: 3,
      bloqueIds: [10],
      fechaInicio: LUNES,
      fechaFin: LUNES,
    })
    const plan = planificar({
      filas: [
        {
          id: 10,
          estado: 'ACTIVO',
          profesorId: 4,
          diaSemana: 1,
          horaInicio: 540,
          horaFin: 600,
          aulaCapacidad: 6,
        },
      ],
      profesor: { id: 4, capacidad: 6, estado: 'ACTIVO' },
      materia: { id: 3, estado: 'ACTIVO' },
      asignacion: { estado: 'ACTIVO' },
      ocupantes: [],
      turnosAlumno: [],
    })
    expect(plan.turnos).toEqual([
      expect.objectContaining({ motivoConsulta: null, fechaInicio: LUNES, fechaFin: LUNES }),
    ])
  })

  it('body inválido → 400 con el campo en path', async () => {
    const casos: [Record<string, unknown>, unknown[][]][] = [
      [{ bloqueIds: [] }, [['bloqueIds']]],
      [{ bloqueIds: [10, 11, 10] }, [['bloqueIds', 2]]],
      [{ bloqueIds: Array.from({ length: 25 }, (_, i) => i + 1) }, [['bloqueIds']]],
      [{ tipo: 'SEMANAL' }, [['tipo']]],
      [{ fechaInicio: '05/01/2099' }, [['fechaInicio']]],
      [{ fechaFin: '2099-01-12' }, [['fechaFin']]], // sesión única con otra fecha de fin
      [{ tipo: 'RECURRENTE', fechaFin: '2098-12-29' }, [['fechaFin']]], // fin antes del inicio
      [{ motivoConsulta: 'x'.repeat(501) }, [['motivoConsulta']]],
      [{ asignarDondeHayLugar: 'si' }, [['asignarDondeHayLugar']]],
      [{ alumnoId: undefined }, [['alumnoId']]],
    ]
    for (const [cambio, paths] of casos) {
      const res = await pedir('', 'POST', { ...BODY, ...cambio })
      expect(res.status, JSON.stringify(cambio)).toBe(400)
      expect(await issues(res)).toEqual(paths)
    }
    expect(repository.reservar).not.toHaveBeenCalled()
  })

  it('acepta un recurrente sin fin (fechaFin null) y una sesión única con fechaFin igual', async () => {
    expect((await pedir('', 'POST', { ...BODY, tipo: 'RECURRENTE', fechaFin: null })).status).toBe(
      201,
    )
    expect((await pedir('', 'POST', { ...BODY, fechaFin: LUNES })).status).toBe(201)
  })
})

describe('GET /turnos/{turnoId}', () => {
  it('200 con el detalle; 404 si no existe; 400 si el id no es válido', async () => {
    repository.buscarDetalle.mockResolvedValueOnce(ejemploDetalle)
    const ok = await pedir('/55')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual(ejemploDetalle)

    repository.buscarDetalle.mockResolvedValueOnce(null)
    expect((await pedir('/99')).status).toBe(404)

    expect(await issues(await pedir('/abc'))).toEqual([['turnoId']])
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara los endpoints con todos sus status codes', () => {
    const codigos = (path: string, metodo: 'get' | 'post') =>
      Object.keys(doc.paths[path]?.[metodo]?.responses ?? {}).sort()

    expect(codigos('/api/v1/turnos/disponibilidad', 'get')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(codigos('/api/v1/turnos', 'post')).toEqual(['201', '400', '401', '403', '404', '409'])
    expect(codigos('/api/v1/turnos/{turnoId}', 'get')).toEqual(['200', '400', '401', '403', '404'])
  })

  it('el 409 del alta trae ejemplos de BLOQUE_LLENO y ALUMNO_SUPERPUESTO', () => {
    const respuesta = doc.paths['/api/v1/turnos']?.post?.responses?.['409'] as {
      content: Record<string, { examples: Record<string, unknown> }>
    }
    expect(Object.keys(respuesta.content['application/json']?.examples ?? {})).toEqual([
      'bloqueLleno',
      'alumnoSuperpuesto',
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

describe('GET /turnos/agenda', () => {
  it('responde 200 con la página que arma el service', async () => {
    const res = await pedirAgenda()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(paginaVacia)
  })

  it('sin query, pagina con los defaults y sin fecha (el service la completa)', async () => {
    await pedirAgenda()
    expect(repository.listarAgenda).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    )
  })

  it('pasa fecha, materiaId, aulaId, profesorId y los términos de q al service', async () => {
    await pedirAgenda('?fecha=2026-09-28&materiaId=2&aulaId=1&profesorId=3&q=juan+perez')
    expect(repository.listarAgenda).toHaveBeenCalledWith({
      fecha: '2026-09-28',
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
      terminos: ['juan', 'perez'],
      page: 1,
      pageSize: 20,
    })
  })

  it.each([
    ['fecha con formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
    ['materiaId no numérico', '?materiaId=abc'],
    ['aulaId cero', '?aulaId=0'],
    ['profesorId negativo', '?profesorId=-1'],
    ['q de más de 100 caracteres', `?q=${'a'.repeat(101)}`],
    ['pageSize mayor a 100', '?pageSize=101'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirAgenda(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirAgenda()).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirAgenda()).status).toBe(403)
  })
})

describe('GET /turnos/materias', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.listarMateriasConTurno.mockResolvedValue([{ id: 2, nombre: 'Matemática' }])
    const res = await pedirMaterias('?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.listarMateriasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    const res = await pedirMaterias()
    expect(res.status).toBe(200)
    expect(repository.listarMateriasConTurno).toHaveBeenCalledWith(expect.any(String))
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirMaterias(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirMaterias('?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirMaterias('?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('GET /turnos/aulas', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.listarAulasConTurno.mockResolvedValue([{ id: 1, nombre: 'Aula 1' }])
    const res = await pedirAulas('?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Aula 1' }])
    expect(repository.listarAulasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    const res = await pedirAulas()
    expect(res.status).toBe(200)
    expect(repository.listarAulasConTurno).toHaveBeenCalledWith(expect.any(String))
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedirAulas(query)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedirAulas('?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedirAulas('?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('OpenAPI de la agenda', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara los endpoints con todos sus status codes', () => {
    const responsesAgenda = doc.paths['/api/v1/turnos/agenda']?.get?.responses ?? {}
    expect(Object.keys(responsesAgenda).sort()).toEqual(['200', '400', '401', '403'])

    const responsesMaterias = doc.paths['/api/v1/turnos/materias']?.get?.responses ?? {}
    expect(Object.keys(responsesMaterias).sort()).toEqual(['200', '400', '401', '403'])

    const responsesAulas = doc.paths['/api/v1/turnos/aulas']?.get?.responses ?? {}
    expect(Object.keys(responsesAulas).sort()).toEqual(['200', '400', '401', '403'])
  })

  it('no expone /turnos/profesores: el filtro de profesor se sacó (decisión T-36)', () => {
    expect(doc.paths['/api/v1/turnos/profesores']).toBeUndefined()
  })

  it('registra los componentes de agenda y de los selectores de materias y aulas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['AgendaItem', 'MateriaConTurno', 'AulaConTurno']),
    )
    expect(Object.keys(doc.components?.schemas ?? {})).not.toContain('ProfesorConTurno')
  })
})

describe('orden de las rutas', () => {
  it('/agenda, /materias, /aulas y /disponibilidad no los captura /{turnoId}', async () => {
    expect((await pedirAgenda()).status).toBe(200)
    expect((await pedirMaterias()).status).toBe(200)
    expect((await pedirAulas()).status).toBe(200)
    expect((await pedir('/disponibilidad?materiaId=3')).status).toBe(200)
    expect(repository.buscarDetalle).not.toHaveBeenCalled()
  })
})
