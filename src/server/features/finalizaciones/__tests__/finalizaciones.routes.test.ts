import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { finalizacionesRoutes } from '../finalizaciones.routes'

// Contrato HTTP de finalizaciones (T-47): validación de Zod, auth y OpenAPI. Sin base ni variables
// de entorno: el repository y Better Auth se reemplazan por mocks. Las reglas se prueban en
// `finalizaciones.reglas.test.ts` y en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { leerSnapshot: vi.fn(), finalizar: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../finalizaciones.repository', () => ({ finalizacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/finalizaciones', finalizacionesRoutes)

// El controller usa el reloj del sistema: la serie se arma alrededor de hoy (empezó hace una
// semana, sin fin) y se finaliza desde hoy.
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta' }).format(
  new Date(),
)

const body = { turnoId: 41, fechaDesde: HOY, motivo: 'CANCELACION_ALUMNO', detalle: 'Se muda' }

function snapshot(pago: Record<string, unknown> = { estado: 'PENDIENTE' }) {
  return {
    turno: {
      id: 41,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      activo: true,
      fechaInicio: sumarDias(HOY, -7),
      fechaFin: null,
      diaSemana: diaSemanaISO(HOY),
      tieneFinalizacion: false,
    },
    ocurrencias: [{ fecha: HOY, horaInicio: 540, horaFin: 600, estado: 'AGENDADO', pago }],
    otrosTramos: [],
  }
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: { user: { id: 'usr_mesa', role, estado: 'ACTIVO' }, session: { id: 's-1' } },
  }
}

function finalizar(datos?: unknown) {
  return app.request('/api/v1/finalizaciones', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

function previa(query: Record<string, string> = { turnoId: '41', fechaDesde: HOY }) {
  return app.request(`/api/v1/finalizaciones/previa?${new URLSearchParams(query)}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerSnapshot.mockResolvedValue(snapshot())
  repository.finalizar.mockImplementation(async (_entrada, verificar) =>
    verificar(await repository.leerSnapshot()),
  )
})

describe('auth', () => {
  it('sin sesión → 401 en los dos endpoints', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })

    expect((await previa()).status).toBe(401)
    expect((await finalizar(body)).status).toBe(401)
  })

  it.each(['PROFESOR', 'GERENTE'])('con %s → 403 en los dos endpoints', async (role) => {
    getSession.mockResolvedValue(sesion(role))

    expect((await previa()).status).toBe(403)
    expect((await finalizar(body)).status).toBe(403)
    expect(repository.leerSnapshot).not.toHaveBeenCalled()
    expect(repository.finalizar).not.toHaveBeenCalled()
  })
})

describe('GET /finalizaciones/previa', () => {
  it('200 con lo que se libera (turnoId llega como texto y se convierte)', async () => {
    const res = await previa()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      cantidad: null,
      desde: HOY,
      hasta: null,
      pagadas: [],
      ultimaFechaPagada: null,
      fechaDesdeMinima: null,
      otrosTramos: [],
    })
    expect(repository.leerSnapshot.mock.calls[0]?.slice(0, 2)).toEqual([41, HOY])
  })

  it('con pagadas: 200 con la lista (horas HH:mm, importe número)', async () => {
    repository.leerSnapshot.mockResolvedValue(
      snapshot({ estado: 'PAGADO', importeAplicado: 8500.5 }),
    )

    const res = await previa()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      pagadas: [{ fecha: HOY, horaInicio: '09:00', horaFin: '10:00', importe: 8500.5 }],
      ultimaFechaPagada: HOY,
      fechaDesdeMinima: sumarDias(HOY, 7),
    })
  })

  it.each([
    ['sin turnoId', { fechaDesde: HOY }, ['turnoId']],
    ['turnoId no numérico', { turnoId: 'abc', fechaDesde: HOY }, ['turnoId']],
    ['turnoId 0', { turnoId: '0', fechaDesde: HOY }, ['turnoId']],
    ['sin fechaDesde', { turnoId: '41' }, ['fechaDesde']],
    ['fecha inexistente', { turnoId: '41', fechaDesde: '2026-02-30' }, ['fechaDesde']],
  ])('%s → 400 VALIDACION en el campo', async (_, query, path) => {
    const res = await previa(query as Record<string, string>)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.leerSnapshot).not.toHaveBeenCalled()
  })

  it('turno inexistente → 404 NO_ENCONTRADO', async () => {
    repository.leerSnapshot.mockResolvedValue({ turno: null, ocurrencias: [], otrosTramos: [] })

    const res = await previa()

    expect(res.status).toBe(404)
    expect((await res.json()).error).toEqual({
      code: 'NO_ENCONTRADO',
      message: 'Turno no encontrado',
    })
  })
})

describe('POST /finalizaciones', () => {
  it('201 con lo liberado y el detalle guardado sin espacios', async () => {
    const res = await finalizar({ ...body, detalle: '  Se muda  ' })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ turnoId: 41, cantidad: null, desde: HOY, hasta: null })
    expect(repository.finalizar.mock.calls[0]?.[0]).toEqual({
      turnoId: 41,
      alumnoId: 12,
      fechaDesde: HOY,
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Se muda',
    })
    expect(repository.finalizar.mock.calls[0]?.[2]).toEqual({
      userId: 'usr_mesa',
      role: 'MESA_ENTRADAS',
    })
  })

  it.each([
    ['sin turnoId', { ...body, turnoId: undefined }, ['turnoId']],
    ['turnoId como texto', { ...body, turnoId: '41' }, ['turnoId']],
    ['fecha inválida', { ...body, fechaDesde: '2026-02-30' }, ['fechaDesde']],
    ['sin fechaDesde', { ...body, fechaDesde: undefined }, ['fechaDesde']],
    ['motivo inválido', { ...body, motivo: 'PORQUE_SI' }, ['motivo']],
    ['sin motivo', { ...body, motivo: undefined }, ['motivo']],
    ['OTRO sin detalle', { ...body, motivo: 'OTRO', detalle: undefined }, ['detalle']],
    ['OTRO con detalle de espacios', { ...body, motivo: 'OTRO', detalle: '   ' }, ['detalle']],
    ['detalle de más de 500', { ...body, detalle: 'x'.repeat(501) }, ['detalle']],
  ])('%s → 400 VALIDACION en el campo', async (_, datos, path) => {
    const res = await finalizar(datos)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.finalizar).not.toHaveBeenCalled()
  })

  it('fechaDesde en otro día de la semana → 400 en fechaDesde', async () => {
    const res = await finalizar({ ...body, fechaDesde: sumarDias(HOY, 1) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.details).toEqual([
      expect.objectContaining({ path: ['fechaDesde'] }),
    ])
  })

  it('una pagada → 409 TURNOS_PAGADOS con details', async () => {
    repository.leerSnapshot.mockResolvedValue(snapshot({ estado: 'PAGADO', importeAplicado: 8500 }))

    const res = await finalizar(body)

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('TURNOS_PAGADOS')
    expect(json.error.details).toEqual({
      ultimaFechaPagada: HOY,
      fechaDesdeMinima: sumarDias(HOY, 7),
      pagadas: [{ fecha: HOY, horaInicio: '09:00', horaFin: '10:00', importe: 8500 }],
    })
    expect(repository.finalizar).not.toHaveBeenCalled()
  })
})

describe('OpenAPI', () => {
  it('declara todos los status codes de los dos endpoints', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })

    expect(
      Object.keys(doc.paths?.['/api/v1/finalizaciones/previa']?.get?.responses ?? {}).sort(),
    ).toEqual(['200', '400', '401', '403', '404', '409'])
    expect(
      Object.keys(doc.paths?.['/api/v1/finalizaciones']?.post?.responses ?? {}).sort(),
    ).toEqual(['201', '400', '401', '403', '404', '409'])
  })
})
