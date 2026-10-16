import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import type { Liquidacion } from '../liquidaciones.condiciones'
import { liquidacionesRoutes } from '../liquidaciones.routes'

// Contrato HTTP del PDF de la liquidación (T-125): auth, quién puede sacar cuál, los headers comunes
// de los documentos y el render real. Sin base ni variables de entorno: Better Auth se reemplaza por
// un mock y el repository por uno falso. El reloj del sistema se fija en 2026-10-15 (hoy en Salta).

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    delMes: vi.fn(),
    deProfesor: vi.fn(),
    leerProfesor: vi.fn(),
    ultimoAdjunto: vi.fn(),
    pagar: vi.fn(),
    profesorIdDeUsuario: vi.fn(),
    todasDelProfesor: vi.fn(),
    clasesDelProfesor: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../liquidaciones.repository', () => ({ liquidacionesRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/liquidaciones', liquidacionesRoutes)

const GOMEZ = { id: 4, nombre: 'Ana', apellido: 'Gómez' }

function sesion(role = 'GERENTE') {
  const alumno = role === 'ALUMNO' ? { alumnoId: 7 } : {}
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_1', name: 'Marta', apellido: 'Ríos', role, estado: 'ACTIVO', ...alumno },
      session: { id: 's-1' },
    },
  }
}

const pagada: Liquidacion = {
  profesor: GOMEZ,
  mes: '2026-09',
  estado: 'PAGADA',
  turnos: [
    {
      pagoTurnoId: 1,
      turnoId: 2,
      fecha: '2026-09-08',
      horaInicio: 960,
      horaFin: 1020,
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      materia: { id: 2, nombre: 'Matemática' },
      numeroComprobante: 123,
      importe: 8000,
      porcentaje: 15,
      fechaDevengo: '2026-09-08',
      parteCentro: 1200,
      parteProfesor: 6800,
    },
  ],
  ajustes: [],
  totalCobrado: 8000,
  parteCentro: 1200,
  parteProfesor: 6800,
  totalAjustes: 0,
  total: 6800,
  cerrada: {
    id: 31,
    fechaTransferencia: '2026-10-05',
    numeroOperacion: '0004829137',
    observaciones: null,
    descontadaEnMes: null,
    registradaPor: { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' },
    registradaEl: '2026-10-05T14:03:00.000Z',
  },
}

const pdfDe = (profesorId: number | string, mes = '2026-09') =>
  app.request(`/api/v1/liquidaciones/profesores/${profesorId}/${mes}/pdf`)
const miPdf = (mes = '2026-09') => app.request(`/api/v1/liquidaciones/mis-liquidaciones/${mes}/pdf`)

/** Los headers del contrato común de los documentos PDF (decisión T-123). */
function esperarHeadersDePdf(res: Response, archivo: string) {
  expect(res.headers.get('content-type')).toBe('application/pdf')
  expect(res.headers.get('content-disposition')).toBe(
    `inline; filename="${archivo}"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
  )
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerProfesor.mockResolvedValue(GOMEZ)
  repository.deProfesor.mockResolvedValue(pagada)
  repository.profesorIdDeUsuario.mockResolvedValue(4)
})

describe('GET /liquidaciones/profesores/{profesorId}/{mes}/pdf', { timeout: 30_000 }, () => {
  it('GERENTE → 200 con el PDF, sus headers y el nombre del archivo', async () => {
    const res = await pdfDe(4)

    expect(res.status).toBe(200)
    esperarHeadersDePdf(res, 'liquidacion-gomez-ana-2026-09.pdf')
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Liquidación Septiembre de 2026')
    expect(repository.deProfesor).toHaveBeenCalledWith({
      profesorId: 4,
      mes: '2026-09',
      hoy: '2026-10-15',
    })
  })

  it('PROFESOR con la suya → 200', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await pdfDe(4)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('PROFESOR con la de otro → 403 y no lee la liquidación', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await pdfDe(9)

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })

  it('PROFESOR sin ficha de profesor → 403', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))
    repository.profesorIdDeUsuario.mockResolvedValue(null)

    expect((await pdfDe(4)).status).toBe(403)
  })

  it.each(['MESA_ENTRADAS', 'ALUMNO'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))

    expect((await pdfDe(4)).status).toBe(403)
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })

    expect((await pdfDe(4)).status).toBe(401)
  })

  it('un mes futuro → 400 en JSON', async () => {
    const res = await pdfDe(4, '2026-11')

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('profesor inexistente → 404', async () => {
    repository.leerProfesor.mockResolvedValue(null)

    expect((await pdfDe(99)).status).toBe(404)
  })
})

describe('GET /liquidaciones/mis-liquidaciones/{mes}/pdf', { timeout: 30_000 }, () => {
  it('PROFESOR → 200 con su liquidación, con el profesor de la sesión', async () => {
    getSession.mockResolvedValue(sesion('PROFESOR'))

    const res = await miPdf()

    expect(res.status).toBe(200)
    esperarHeadersDePdf(res, 'liquidacion-gomez-ana-2026-09.pdf')
    expect(repository.profesorIdDeUsuario).toHaveBeenCalledWith('usr_1')
    expect(repository.deProfesor).toHaveBeenCalledWith({
      profesorId: 4,
      mes: '2026-09',
      hoy: '2026-10-15',
    })
  })

  it.each(['GERENTE', 'MESA_ENTRADAS'])('con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))

    expect((await miPdf()).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
  const status = (path: string) => Object.keys(doc.paths[path]?.get?.responses ?? {}).sort()

  it('declara los dos PDF con sus status codes y la respuesta binaria', () => {
    expect(status('/api/v1/liquidaciones/profesores/{profesorId}/{mes}/pdf')).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(status('/api/v1/liquidaciones/mis-liquidaciones/{mes}/pdf')).toEqual([
      '200',
      '400',
      '401',
      '403',
    ])
    const ok = doc.paths['/api/v1/liquidaciones/profesores/{profesorId}/{mes}/pdf']?.get
      ?.responses?.['200'] as { content?: Record<string, unknown> } | undefined
    expect(Object.keys(ok?.content ?? {})).toEqual(['application/pdf'])
  })
})
