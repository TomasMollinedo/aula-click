import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { ejemploDetalle } from '../turnos.ejemplos'
import { turnosRoutes } from '../turnos.routes'
import type { PlanReserva, SnapshotAlta } from '../turnos.validation'

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
    deudaVencidaDe: vi.fn(),
    listarMateriasOfertadas: vi.fn(),
  },
  alumnosRepository: { buscarPorId: vi.fn() },
  bloquesRepository: { buscarPorIds: vi.fn(), listarActivasDeProfesores: vi.fn() },
  profesoresRepository: {
    listarProfesoresActivosDeMateria: vi.fn(),
    buscarConAsignaciones: vi.fn(),
  },
  materiasRepository: { buscarPorIds: vi.fn(), buscarPorId: vi.fn() },
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
  temas: 'Fracciones',
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

/** Sesión del alumno 12 en el portal (`alumnoId` sale del usuario de la sesión, T-75). */
function sesionAlumno(alumnoId: number | null = 12) {
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_alumno_12', role: 'ALUMNO', estado: 'ACTIVO', alumnoId },
      session: { id: 's-2' },
    },
  }
}

/** Body del portal: el de la mesa sin `alumnoId` ni `observaciones`. Lunes lejano, desde mañana. */
const MI_BODY = {
  materiaId: 3,
  bloqueIds: [10],
  tipo: 'SESION_UNICA',
  fechaInicio: LUNES,
  temas: 'Fracciones',
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
  repository.deudaVencidaDe.mockResolvedValue({ cantidad: 0, total: 0 })
  repository.listarMateriasOfertadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])
  materiasRepository.buscarPorId.mockResolvedValue({ precioHora: 8000 })
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

  it('el alumno no entra a los endpoints de la mesa (403), aunque mande un alumnoId', async () => {
    getSession.mockResolvedValue(sesionAlumno())
    expect((await pedir('/disponibilidad?materiaId=3')).status).toBe(403)
    expect((await pedir('', 'POST', { ...BODY, alumnoId: 99 })).status).toBe(403)
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

  it('normaliza el body: bandera en false por defecto y observaciones vacías como null', async () => {
    await pedir('', 'POST', { ...BODY, observaciones: '   ' })

    const [entrada, planificar] = repository.reservar.mock.calls[0] as [
      unknown,
      (snapshot: SnapshotAlta) => PlanReserva,
    ]
    expect(entrada).toEqual({
      hoy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
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
      deudaVencida: { cantidad: 0, total: 0 },
    })
    expect(plan.turnos).toEqual([
      expect.objectContaining({
        observaciones: null,
        temas: 'Fracciones',
        fechaInicio: LUNES,
        fechaFin: LUNES,
      }),
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
      [{ observaciones: 'x'.repeat(501) }, [['observaciones']]],
      [{ temas: 'x'.repeat(501) }, [['temas']]],
      [{ temas: undefined }, [['temas']]], // sesión única sin temas
      [{ temas: '   ' }, [['temas']]], // vacío es null, y sigue faltando en sesión única
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

  it('temas es opcional en un recurrente, aunque obligatorio en una sesión única', async () => {
    const res = await pedir('', 'POST', {
      ...BODY,
      tipo: 'RECURRENTE',
      fechaFin: null,
      temas: undefined,
    })
    expect(res.status).toBe(201)
  })
})

describe('portal: /turnos/mis-turnos (HU-29)', () => {
  const PORTAL: [string, string, unknown?][] = [
    ['/mis-turnos/habilitacion', 'GET'],
    ['/mis-turnos/materias', 'GET'],
    ['/mis-turnos/disponibilidad?materiaId=3', 'GET'],
    ['/mis-turnos', 'POST', MI_BODY],
  ]

  beforeEach(() => {
    getSession.mockResolvedValue(sesionAlumno())
  })

  it('sin sesión → 401; con un rol del personal → 403; un ALUMNO sin alumno vinculado → 403', async () => {
    for (const sesionDePrueba of [
      { headers: new Headers(), response: null },
      sesion('MESA_ENTRADAS'),
      sesion('PROFESOR'),
      sesion('GERENTE'),
      sesionAlumno(null),
    ]) {
      getSession.mockResolvedValue(sesionDePrueba)
      for (const [path, metodo, body] of PORTAL) {
        const esperado = sesionDePrueba.response === null ? 401 : 403
        expect((await pedir(path, metodo, body)).status, `${metodo} ${path}`).toBe(esperado)
      }
    }
    expect(repository.reservar).not.toHaveBeenCalled()
    expect(repository.deudaVencidaDe).not.toHaveBeenCalled()
  })

  it('GET /mis-turnos/habilitacion: 200 con la deuda del alumno de la sesión', async () => {
    repository.deudaVencidaDe.mockResolvedValue({ cantidad: 3, total: 24000 })

    const res = await pedir('/mis-turnos/habilitacion')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ habilitado: false, deuda: { cantidad: 3, total: 24000 } })
    expect(repository.deudaVencidaDe).toHaveBeenCalledWith(12, expect.any(String))
  })

  it('GET /mis-turnos/materias: 200 con las materias', async () => {
    const res = await pedir('/mis-turnos/materias')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 3, nombre: 'Matemática' }])
  })

  it('GET /mis-turnos/disponibilidad: 200 sin cupos; mismo query que la mesa (400 en cada campo)', async () => {
    bloquesRepository.listarActivasDeProfesores.mockResolvedValue([
      {
        id: 10,
        profesorId: 4,
        profesorCapacidad: 6,
        diaSemana: 1,
        horaInicio: 540,
        horaFin: 600,
        aula: { id: 3, nombre: 'Aula 3', capacidad: 8 },
      },
    ])

    const res = await pedir('/mis-turnos/disponibilidad?materiaId=3&diaSemana=1')
    expect(res.status).toBe(200)
    const cuerpo = JSON.stringify(await res.json())
    expect(cuerpo).toContain('"disponible":true')
    expect(cuerpo).toContain('"valorPorClase":8000')
    expect(cuerpo).not.toMatch(/capacidadEfectiva|ocupacion|lleno/)

    expect(await issues(await pedir('/mis-turnos/disponibilidad'))).toEqual([['materiaId']])
    expect(await issues(await pedir('/mis-turnos/disponibilidad?materiaId=3&diaSemana=8'))).toEqual(
      [['diaSemana']],
    )
  })

  it('POST /mis-turnos: 201 con el resumen, para el alumno de la sesión', async () => {
    const res = await pedir('/mis-turnos', 'POST', MI_BODY)

    expect(res.status).toBe(201)
    const reservado = (await res.json()) as Record<string, unknown>
    expect(reservado).toMatchObject({ cantidad: 1, tipo: ejemploDetalle.tipo })
    expect(JSON.stringify(reservado)).not.toMatch(/observaciones|createdBy|updatedBy|"dni"/)
    const [entrada, , actor] = repository.reservar.mock.calls[0] as [
      { alumnoId: number },
      unknown,
      { userId: string; alumnoId: number },
    ]
    expect(entrada.alumnoId).toBe(12)
    expect(actor).toMatchObject({ userId: 'usr_alumno_12', role: 'ALUMNO', alumnoId: 12 })
  })

  it('POST /mis-turnos: un alumnoId de otro alumno y las observaciones del body se descartan', async () => {
    const res = await pedir('/mis-turnos', 'POST', {
      ...MI_BODY,
      alumnoId: 99,
      observaciones: 'Nota interna',
    })

    expect(res.status).toBe(201)
    expect(alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
    const [entrada, planificar] = repository.reservar.mock.calls[0] as [
      { alumnoId: number },
      (snapshot: SnapshotAlta) => PlanReserva,
    ]
    expect(entrada.alumnoId).toBe(12)
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
      deudaVencida: { cantidad: 0, total: 0 },
    })
    expect(plan.turnos).toEqual([expect.objectContaining({ alumnoId: 12, observaciones: null })])
  })

  it('POST /mis-turnos: body inválido → 400 con el campo en path (las reglas de formato de la mesa)', async () => {
    const casos: [Record<string, unknown>, unknown[][]][] = [
      [{ bloqueIds: [] }, [['bloqueIds']]],
      [{ tipo: 'SEMANAL' }, [['tipo']]],
      [{ temas: undefined }, [['temas']]], // sesión única sin temas
      [{ tipo: 'RECURRENTE', fechaFin: '2098-12-29' }, [['fechaFin']]],
      [{ materiaId: undefined }, [['materiaId']]],
    ]
    for (const [cambio, paths] of casos) {
      const res = await pedir('/mis-turnos', 'POST', { ...MI_BODY, ...cambio })
      expect(res.status, JSON.stringify(cambio)).toBe(400)
      expect(await issues(res)).toEqual(paths)
    }
    expect(repository.reservar).not.toHaveBeenCalled()
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
    expect(codigos('/api/v1/turnos/mis-turnos/habilitacion', 'get')).toEqual(['200', '401', '403'])
    expect(codigos('/api/v1/turnos/mis-turnos/materias', 'get')).toEqual(['200', '401', '403'])
    expect(codigos('/api/v1/turnos/mis-turnos/disponibilidad', 'get')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(codigos('/api/v1/turnos/mis-turnos', 'post')).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
  })

  it('el 409 del alta trae ejemplos de BLOQUE_LLENO, ALUMNO_SUPERPUESTO y DEUDA_VENCIDA', () => {
    const ejemplos = (path: string) => {
      const respuesta = doc.paths[path]?.post?.responses?.['409'] as {
        content: Record<string, { examples: Record<string, unknown> }>
      }
      return Object.keys(respuesta.content['application/json']?.examples ?? {}).sort()
    }
    expect(ejemplos('/api/v1/turnos')).toEqual(['alumnoSuperpuesto', 'bloqueLleno', 'deudaVencida'])
    expect(ejemplos('/api/v1/turnos/mis-turnos')).toEqual([
      'alumnoSuperpuesto',
      'bloqueLleno',
      'deudaVencida',
    ])
  })

  it('el body del portal no declara alumnoId ni observaciones', () => {
    const body = doc.paths['/api/v1/turnos/mis-turnos']?.post?.requestBody as {
      content: Record<string, { schema: { $ref?: string } }>
    }
    const ref = body.content['application/json']?.schema.$ref ?? ''
    const nombre = ref.split('/').at(-1) ?? ''
    const schema = doc.components?.schemas?.[nombre] as { properties: Record<string, unknown> }
    expect(Object.keys(schema.properties)).not.toContain('alumnoId')
    expect(Object.keys(schema.properties)).not.toContain('observaciones')
  })
})

describe('orden de las rutas', () => {
  it('/disponibilidad no la captura /{turnoId}', async () => {
    expect((await pedir('/disponibilidad?materiaId=3')).status).toBe(200)
    expect(repository.buscarDetalle).not.toHaveBeenCalled()
  })

  it('las rutas estáticas de /mis-turnos no las captura /{turnoId}', async () => {
    getSession.mockResolvedValue(sesionAlumno())
    expect((await pedir('/mis-turnos/habilitacion')).status).toBe(200)
    expect((await pedir('/mis-turnos/materias')).status).toBe(200)
    expect((await pedir('/mis-turnos/disponibilidad?materiaId=3')).status).toBe(200)
    expect(repository.buscarDetalle).not.toHaveBeenCalled()
  })
})

describe('las agendas ya no viven en /turnos (T-30)', () => {
  it('/turnos/agenda, /agenda-propia, /agenda-profesor, /materias y /aulas no existen (sin alias)', () => {
    const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
    for (const viejo of ['agenda', 'agenda-propia', 'agenda-profesor', 'materias', 'aulas']) {
      expect(doc.paths[`/api/v1/turnos/${viejo}`]).toBeUndefined()
    }
  })
})
