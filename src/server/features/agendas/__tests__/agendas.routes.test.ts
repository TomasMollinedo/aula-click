import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { agendasRoutes } from '../agendas.routes'

// Contrato HTTP de las agendas (se movieron de `/turnos/*` a `/agendas/*` en T-30, con el mismo
// contrato): validación de Zod, auth y OpenAPI. Sin base ni variables de entorno: los repositories
// y Better Auth se reemplazan por mocks. Las reglas se prueban en el service.

const { repository, profesoresRepository, aulasRepository, getSession } = vi.hoisted(() => ({
  repository: { leerOcurrencias: vi.fn(), leerPrioridades: vi.fn() },
  profesoresRepository: { buscarIdPorUsuario: vi.fn(), buscarConAsignaciones: vi.fn() },
  aulasRepository: { listar: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../agendas.repository', () => ({ agendasRepository: repository }))
vi.mock('@/server/features/profesores/profesores.repository', () => ({ profesoresRepository }))
vi.mock('@/server/features/aulas/aulas.repository', () => ({ aulasRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/agendas', agendasRoutes)

/** Examen que determina la prioridad del alumno de `OCURRENCIA`, como lo arma `leerPrioridades`. */
const EXAMEN = {
  id: 5,
  fecha: '2099-01-20',
  tipo: 'PARCIAL',
  materiaNombre: 'Matemática',
  dias: 15,
}

const paginaVacia = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }

/** Una ocurrencia del motor, con los campos internos (`busqueda`) que no deben salir. */
const OCURRENCIA = {
  turnoId: 15,
  fecha: '2099-01-05',
  bloqueAgendaId: 10,
  diaSemana: 1,
  horaInicio: 540,
  horaFin: 600,
  profesorId: 3,
  aulaId: 1,
  alumnoId: 12,
  materiaId: 2,
  tipo: 'RECURRENTE',
  estado: 'AGENDADO',
  pago: { estado: 'PENDIENTE' },
  serie: { fechaInicio: '2099-01-05', fechaFin: null, finEfectivo: null },
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
  materia: { id: 2, nombre: 'Matemática' },
  aula: { id: 1, nombre: 'Aula 1' },
}

function pedir(path: string) {
  return app.request(`/api/v1/agendas${path}`)
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerOcurrencias.mockResolvedValue([])
  // Prioridad del alumno 12 en la materia 2 ese día, como la arma `leerPrioridades`.
  repository.leerPrioridades.mockResolvedValue(
    new Map([['12-2-2099-01-05', { prioridad: 'MEDIA', examen: EXAMEN }]]),
  )
  aulasRepository.listar.mockResolvedValue([])
})

// ---------------------------------------------------------------------------------------------
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

describe('GET /agendas/diaria', () => {
  it('responde 200 con la página que arma el service', async () => {
    const res = await pedir('/diaria')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(paginaVacia)
  })

  it('pasa fecha, materiaId, aulaId y profesorId al motor', async () => {
    await pedir('/diaria?fecha=2026-09-28&materiaId=2&aulaId=1&profesorId=3&q=juan+perez')
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2026-09-28', hasta: '2026-09-28', materiaId: 2, aulaId: 1, profesorId: 3 },
      undefined,
    )
  })

  it('la respuesta no incluye `busqueda` (campo interno del motor)', async () => {
    repository.leerOcurrencias.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/diaria?fecha=2099-01-05')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(JSON.parse(texto).data).toEqual([
      {
        turnoId: 15,
        fecha: '2099-01-05',
        bloqueAgendaId: 10,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
        profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
        materia: { id: 2, nombre: 'Matemática' },
        aula: { id: 1, nombre: 'Aula 1' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: 'MEDIA',
        examen: EXAMEN,
      },
    ])
  })

  it('filtra por prioridad y por estado: los pasa al service y devuelve sólo lo que cumple', async () => {
    repository.leerOcurrencias.mockResolvedValue([
      OCURRENCIA,
      { ...OCURRENCIA, turnoId: 16, alumnoId: 13, estado: 'CANCELADO' },
    ])

    const altas = await pedir('/diaria?fecha=2099-01-05&prioridad=ALTA')
    expect(altas.status).toBe(200)
    expect((await altas.json()).data).toEqual([])

    const canceladas = await pedir('/diaria?fecha=2099-01-05&estado=CANCELADO')
    const { data } = await canceladas.json()
    expect(data).toEqual([
      expect.objectContaining({ turnoId: 16, estado: 'CANCELADO', prioridad: null, examen: null }),
    ])
  })

  it.each([
    ['fecha con formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
    ['materiaId no numérico', '?materiaId=abc'],
    ['aulaId cero', '?aulaId=0'],
    ['profesorId negativo', '?profesorId=-1'],
    ['estado desconocido', '?estado=ACTIVO'],
    ['prioridad desconocida', '?prioridad=URGENTE'],
    ['q de más de 100 caracteres', `?q=${'a'.repeat(101)}`],
    ['pageSize mayor a 100', '?pageSize=101'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/diaria${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/diaria')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/diaria')).status).toBe(403)
  })
})

describe('GET /agendas/propia', () => {
  beforeEach(() => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(4)
  })

  it('responde 200 con el arreglo que arma el service, sin envolver en { data } y sin `busqueda`', async () => {
    repository.leerOcurrencias.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/propia?desde=2099-01-05&hasta=2099-01-11')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(JSON.parse(texto)).toEqual([
      {
        turnoId: 15,
        fecha: '2099-01-05',
        bloqueAgendaId: 10,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
        materia: { id: 2, nombre: 'Matemática' },
        aula: { id: 1, nombre: 'Aula 1' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: 'MEDIA',
        examen: EXAMEN,
      },
    ])
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { profesorId: 4, desde: '2099-01-05', hasta: '2099-01-11' },
      undefined,
    )
  })

  it('el profesor sale de la sesión: un profesorId en el query no cambia nada', async () => {
    await pedir('/propia?desde=2099-01-05&profesorId=99')
    expect(profesoresRepository.buscarIdPorUsuario).toHaveBeenCalledWith('usr_mesa')
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { profesorId: 4, desde: '2099-01-05', hasta: '2099-01-05' },
      undefined,
    )
  })

  it.each([
    ['desde con formato inválido', '?desde=05-01-2099'],
    ['hasta inexistente', '?hasta=2099-02-30'],
    ['hasta anterior a desde', '?desde=2099-01-05&hasta=2099-01-04'],
    ['rango mayor al máximo', '?desde=2099-01-05&hasta=2099-02-05'],
    ['estado desconocido', '?estado=ACTIVO'],
    ['prioridad desconocida', '?prioridad=URGENTE'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/propia${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('el usuario de la sesión no tiene ficha de profesor → 404', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(null)
    expect((await pedir('/propia')).status).toBe(404)
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/propia')).status).toBe(401)
  })

  it('con un rol que no es PROFESOR → 403', async () => {
    getSession.mockResolvedValue(sesion('MESA_ENTRADAS'))
    const res = await pedir('/propia')
    expect(res.status).toBe(403)
    expect(repository.leerOcurrencias).not.toHaveBeenCalled()
  })
})

describe('GET /agendas/profesor', () => {
  beforeEach(() => {
    profesoresRepository.buscarConAsignaciones.mockResolvedValue({
      estado: 'ACTIVO',
      asignaciones: [],
    })
  })

  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    const res = await pedir('/profesor?profesorId=7&desde=2099-01-05&hasta=2099-01-11')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { profesorId: 7, desde: '2099-01-05', hasta: '2099-01-11' },
      undefined,
    )
  })

  it.each([
    ['sin profesorId', '?desde=2099-01-05'],
    ['profesorId inválido', '?profesorId=abc'],
    ['rango mayor al máximo', '?profesorId=7&desde=2099-01-05&hasta=2099-02-05'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/profesor${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('el profesor no existe → 404', async () => {
    profesoresRepository.buscarConAsignaciones.mockResolvedValue(null)
    expect((await pedir('/profesor?profesorId=99')).status).toBe(404)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    const res = await pedir('/profesor?profesorId=7')
    expect(res.status).toBe(403)
    expect(repository.leerOcurrencias).not.toHaveBeenCalled()
  })
})

describe('GET /agendas/centro', () => {
  it('responde 200 con el arreglo que arma el service (con profesor), sin envolver en { data } y sin `busqueda`', async () => {
    repository.leerOcurrencias.mockResolvedValue([OCURRENCIA])

    const res = await pedir('/centro?desde=2099-01-05&hasta=2099-01-11')
    const texto = await res.text()

    expect(res.status).toBe(200)
    expect(texto).not.toContain('busqueda')
    expect(JSON.parse(texto)).toEqual([
      {
        turnoId: 15,
        fecha: '2099-01-05',
        bloqueAgendaId: 10,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
        profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
        materia: { id: 2, nombre: 'Matemática' },
        aula: { id: 1, nombre: 'Aula 1' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: 'MEDIA',
        examen: EXAMEN,
      },
    ])
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2099-01-05', hasta: '2099-01-11' },
      undefined,
    )
  })

  it('pasa profesor, materia y aula al motor y filtra por estado y prioridad', async () => {
    await pedir(
      '/centro?desde=2099-01-05&hasta=2099-01-11&profesorId=3&materiaId=2&aulaId=1&estado=AGENDADO&prioridad=ALTA',
    )

    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2099-01-05', hasta: '2099-01-11', profesorId: 3, materiaId: 2, aulaId: 1 },
      undefined,
    )
  })

  it.each([
    ['sin desde', '?hasta=2099-01-11'],
    ['sin hasta', '?desde=2099-01-05'],
    ['desde con formato inválido', '?desde=05-01-2099&hasta=2099-01-11'],
    ['hasta anterior a desde', '?desde=2099-01-05&hasta=2099-01-04'],
    ['rango mayor a 31 días', '?desde=2099-01-05&hasta=2099-02-05'],
    ['profesorId cero', '?desde=2099-01-05&hasta=2099-01-11&profesorId=0'],
    ['estado desconocido', '?desde=2099-01-05&hasta=2099-01-11&estado=ACTIVO'],
    ['prioridad desconocida', '?desde=2099-01-05&hasta=2099-01-11&prioridad=URGENTE'],
  ])('%s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/centro${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
    expect(repository.leerOcurrencias).not.toHaveBeenCalled()
  })

  it('un rango de 31 días se acepta', async () => {
    expect((await pedir('/centro?desde=2099-01-05&hasta=2099-02-04')).status).toBe(200)
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/centro?desde=2099-01-05&hasta=2099-01-11')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    const res = await pedir('/centro?desde=2099-01-05&hasta=2099-01-11')
    expect(res.status).toBe(403)
    expect(repository.leerOcurrencias).not.toHaveBeenCalled()
  })
})

describe('GET /agendas/materias', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.leerOcurrencias.mockResolvedValue([OCURRENCIA])
    const res = await pedir('/materias?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, nombre: 'Matemática' }])
    expect(repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2026-09-28', hasta: '2026-09-28' },
      undefined,
    )
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    expect((await pedir('/materias')).status).toBe(200)
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/materias${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/materias?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/materias?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('GET /agendas/aulas', () => {
  it('responde 200 con el arreglo que arma el service, sin envolver en { data }', async () => {
    repository.leerOcurrencias.mockResolvedValue([OCURRENCIA])
    aulasRepository.listar.mockResolvedValue([
      { id: 1, nombre: 'Aula 1', capacidad: 6, estado: 'ACTIVO' },
    ])
    const res = await pedir('/aulas?fecha=2026-09-28')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, nombre: 'Aula 1' }])
  })

  it('sin fecha, responde 200 (el service completa con la de hoy)', async () => {
    expect((await pedir('/aulas')).status).toBe(200)
  })

  it.each([
    ['formato inválido', '?fecha=28-09-2026'],
    ['fecha inexistente', '?fecha=2026-02-30'],
  ])('fecha con %s → 400 VALIDACION', async (_caso, query) => {
    const res = await pedir(`/aulas${query}`)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/aulas?fecha=2026-09-28')).status).toBe(401)
  })

  it('con un rol que no es MESA_ENTRADAS → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    expect((await pedir('/aulas?fecha=2026-09-28')).status).toBe(403)
  })
})

describe('OpenAPI de las agendas', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const codigos = (path: string) =>
    Object.keys(doc.paths[`/api/v1/agendas${path}`]?.get?.responses ?? {}).sort()

  it('declara los endpoints con todos sus status codes', () => {
    expect(codigos('/diaria')).toEqual(['200', '400', '401', '403'])
    expect(codigos('/materias')).toEqual(['200', '400', '401', '403'])
    expect(codigos('/aulas')).toEqual(['200', '400', '401', '403'])
    expect(codigos('/propia')).toEqual(['200', '400', '401', '403', '404'])
    expect(codigos('/profesor')).toEqual(['200', '400', '401', '403', '404'])
    expect(codigos('/centro')).toEqual(['200', '400', '401', '403'])
  })

  it('la agenda propia no recibe el profesor por parámetro (sale del Actor)', () => {
    const parametros = doc.paths['/api/v1/agendas/propia']?.get?.parameters ?? []
    expect(parametros.map((parametro) => (parametro as { name: string }).name).sort()).toEqual([
      'desde',
      'estado',
      'hasta',
      'prioridad',
    ])
  })

  it('registra los componentes de agenda y de los selectores de materias y aulas', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'AgendaItem',
        'AgendaPropiaItem',
        'AgendaExamen',
        'MateriaConTurno',
        'AulaConTurno',
      ]),
    )
    expect(Object.keys(doc.components?.schemas ?? {})).not.toContain('ProfesorConTurno')
  })

  it('conserva los ejemplos del OpenAPI', () => {
    const ejemplo = (path: string) =>
      (
        doc.paths[`/api/v1/agendas${path}`]?.get?.responses?.['200'] as {
          content: Record<string, { example?: unknown }>
        }
      ).content['application/json']?.example
    for (const path of ['/diaria', '/propia', '/profesor', '/centro', '/materias', '/aulas']) {
      expect(ejemplo(path), path).toBeDefined()
    }
  })
})
