import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { pagosRoutes } from '../pagos.routes'

// Contrato HTTP de pagos (T-51): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: los repositories y Better Auth se reemplazan por mocks. Las reglas se prueban en el
// service y en `pagos.reglas`.

const { repository, alumnosRepository, getSession } = vi.hoisted(() => ({
  repository: { leerSnapshot: vi.fn(), registrar: vi.fn(), buscarComprobante: vi.fn() },
  alumnosRepository: { buscarPorId: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../pagos.repository', () => ({ pagosRepository: repository }))
vi.mock('@/server/features/alumnos/alumnos.repository', () => ({ alumnosRepository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/pagos', pagosRoutes)

const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Salta' }).format(
  new Date(),
)

const body = {
  alumnoId: 12,
  ocurrencias: [{ turnoId: 41, fecha: HOY }],
  fechaPago: HOY,
  formaPago: 'EFECTIVO',
  montoRecibido: 10000,
}

/** El mismo cobro por transferencia y con débito, con sus datos y sin los del efectivo. */
const sinMonto = {
  alumnoId: body.alumnoId,
  ocurrencias: body.ocurrencias,
  fechaPago: body.fechaPago,
}
const TRANSFERENCIA = {
  ...sinMonto,
  formaPago: 'TRANSFERENCIA',
  transferencia: { operacion: '0004829137', banco: 'Banco Macro' },
  comprobanteAdjuntoId: 18,
}
const DEBITO = {
  ...sinMonto,
  formaPago: 'DEBITO',
  debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
}

const comprobante = {
  id: 31,
  numeroComprobante: 1024,
  fechaPago: HOY,
  alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
  turnos: [],
  total: 8000,
  montoRecibido: 10000,
  formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
  transferencia: null,
  debito: null,
  estado: 'VIGENTE',
  anulacion: null,
  observaciones: null,
  registradoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  registradoEl: '2026-10-05T15:00:00.000Z',
}

function sesion(role = 'MESA_ENTRADAS') {
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_mesa', role, estado: 'ACTIVO', name: 'Laura', apellido: 'Gómez' },
      session: { id: 's-1' },
    },
  }
}

function pedir(path: string, metodo = 'GET', datos?: unknown) {
  return app.request(`/api/v1/pagos${path}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  alumnosRepository.buscarPorId.mockResolvedValue({ id: 12 })
  repository.leerSnapshot.mockResolvedValue({
    ocurrencias: [
      {
        turnoId: 41,
        fecha: HOY,
        alumnoId: 12,
        materiaId: 2,
        estado: 'AGENDADO',
        pago: { estado: 'PENDIENTE' },
      },
    ],
    precios: new Map([[2, 8000]]),
  })
  repository.registrar.mockImplementation(async (_entrada, verificar) => ({
    pagoId: 31,
    numeroComprobante: 1024,
    plan: verificar(await repository.leerSnapshot()),
  }))
  repository.buscarComprobante.mockResolvedValue(comprobante)
})

describe('auth', () => {
  it.each([
    ['POST', ''],
    ['GET', '/31'],
    ['GET', '/31/pdf'],
  ])('%s %s sin sesión → 401', async (metodo, path) => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedir(path, metodo, metodo === 'POST' ? body : undefined)
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
  })

  it.each(['PROFESOR', 'GERENTE', 'ALUMNO'])('POST y GET con %s → 403', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    expect((await pedir('', 'POST', body)).status).toBe(403)
    expect((await pedir('/31')).status).toBe(403)
    const pdf = await pedir('/31/pdf')
    expect(pdf.status).toBe(403)
    expect((await pdf.json()).error.code).toBe('SIN_PERMISO')
    expect(repository.registrar).not.toHaveBeenCalled()
    expect(repository.buscarComprobante).not.toHaveBeenCalled()
  })
})

describe('POST /pagos', () => {
  it('201 con el total, el monto recibido y el vuelto', async () => {
    const res = await pedir('', 'POST', body)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      pagoId: 31,
      numeroComprobante: 1024,
      cantidad: 1,
      total: 8000,
      formaPago: 'EFECTIVO',
      montoRecibido: 10000,
      vuelto: 2000,
    })
    expect(repository.registrar.mock.calls[0]?.[0].medio).toEqual({
      formaPago: 'EFECTIVO',
      montoRecibido: 10000,
    })
  })

  it('201 por transferencia: sus datos y el adjunto llegan al repository; sin monto ni vuelto', async () => {
    const res = await pedir('', 'POST', TRANSFERENCIA)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      total: 8000,
      formaPago: 'TRANSFERENCIA',
      montoRecibido: null,
      vuelto: null,
    })
    expect(repository.registrar.mock.calls[0]?.[0].medio).toEqual({
      formaPago: 'TRANSFERENCIA',
      transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: undefined },
      comprobanteAdjuntoId: 18,
    })
  })

  it('201 con débito, sin adjunto (es opcional): red, cupón y últimos 4', async () => {
    const res = await pedir('', 'POST', DEBITO)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      formaPago: 'DEBITO',
      montoRecibido: null,
      vuelto: null,
    })
    expect(repository.registrar.mock.calls[0]?.[0].medio).toEqual({
      formaPago: 'DEBITO',
      debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
      comprobanteAdjuntoId: null,
    })
  })

  it('con débito, el adjunto es opcional: si viene, se vincula', async () => {
    expect((await pedir('', 'POST', { ...DEBITO, comprobanteAdjuntoId: 18 })).status).toBe(201)
    expect(repository.registrar.mock.calls[0]?.[0].medio).toMatchObject({
      comprobanteAdjuntoId: 18,
    })
  })

  it('con débito, últimos 4 vacío es "sin últimos 4"', async () => {
    const res = await pedir('', 'POST', { ...DEBITO, debito: { ...DEBITO.debito, ultimos4: '' } })
    expect(res.status).toBe(201)
    expect(repository.registrar.mock.calls[0]?.[0].medio).toMatchObject({
      debito: { ultimos4: null },
    })
  })

  it.each([
    ['sin ocurrencias', { ...body, ocurrencias: [] }, ['ocurrencias']],
    [
      'más de 200 ocurrencias',
      {
        ...body,
        ocurrencias: Array.from({ length: 201 }, (_, i) => ({ turnoId: i + 1, fecha: HOY })),
      },
      ['ocurrencias'],
    ],
    [
      'ocurrencia repetida',
      { ...body, ocurrencias: [body.ocurrencias[0], body.ocurrencias[0]] },
      ['ocurrencias', 1],
    ],
    [
      'fecha inválida',
      { ...body, ocurrencias: [{ turnoId: 41, fecha: '2026-02-30' }] },
      ['ocurrencias', 0, 'fecha'],
    ],
    ['sin fechaPago', { ...body, fechaPago: undefined }, ['fechaPago']],
    ['sin formaPago (no hay valor por defecto)', { ...body, formaPago: undefined }, ['formaPago']],
    ['formaPago desconocida', { ...body, formaPago: 'CHEQUE' }, ['formaPago']],
    ['sin montoRecibido', { ...body, montoRecibido: undefined }, ['montoRecibido']],
    ['montoRecibido null', { ...body, montoRecibido: null }, ['montoRecibido']],
    ['montoRecibido 0', { ...body, montoRecibido: 0 }, ['montoRecibido']],
    ['montoRecibido con tres decimales', { ...body, montoRecibido: 100.005 }, ['montoRecibido']],
    [
      'montoRecibido fuera de Decimal(10,2)',
      { ...body, montoRecibido: 100_000_000 },
      ['montoRecibido'],
    ],
    ['observaciones de más de 500', { ...body, observaciones: 'x'.repeat(501) }, ['observaciones']],
    ['alumnoId inválido', { ...body, alumnoId: 0 }, ['alumnoId']],
  ])('%s → 400 VALIDACION en el campo', async (_, datos, path) => {
    const res = await pedir('', 'POST', datos)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(repository.registrar).not.toHaveBeenCalled()
  })

  // Un pago, un medio (HU-23): cada forma pide sus datos y rechaza los de las otras.
  it.each([
    [
      'efectivo con datos de transferencia',
      { ...body, transferencia: TRANSFERENCIA.transferencia },
      ['transferencia'],
      'Los datos de la transferencia sólo van en un pago por transferencia',
    ],
    [
      'efectivo con datos de débito',
      { ...body, debito: DEBITO.debito },
      ['debito'],
      'Los datos del débito sólo van en un pago con débito',
    ],
    [
      'efectivo con comprobante adjunto',
      { ...body, comprobanteAdjuntoId: 18 },
      ['comprobanteAdjuntoId'],
      'Un pago en efectivo no lleva comprobante adjunto',
    ],
    [
      'transferencia sin comprobante adjunto',
      { ...TRANSFERENCIA, comprobanteAdjuntoId: undefined },
      ['comprobanteAdjuntoId'],
      'El comprobante es obligatorio con transferencia',
    ],
    [
      'transferencia sin sus datos',
      { ...TRANSFERENCIA, transferencia: undefined },
      ['transferencia'],
      'Faltan los datos de la transferencia',
    ],
    [
      'transferencia con monto recibido',
      { ...TRANSFERENCIA, montoRecibido: 10000 },
      ['montoRecibido'],
      'El monto recibido sólo va en un pago en efectivo',
    ],
    [
      'transferencia con datos de débito',
      { ...TRANSFERENCIA, debito: DEBITO.debito },
      ['debito'],
      'Los datos del débito sólo van en un pago con débito',
    ],
    [
      'transferencia sin operación',
      { ...TRANSFERENCIA, transferencia: { banco: 'Banco Macro' } },
      ['transferencia', 'operacion'],
      'Campo obligatorio',
    ],
    [
      'transferencia con operación de más de 50',
      { ...TRANSFERENCIA, transferencia: { operacion: '9'.repeat(51), banco: 'Macro' } },
      ['transferencia', 'operacion'],
      'No puede superar los 50 caracteres',
    ],
    [
      'transferencia con titular de más de 100',
      {
        ...TRANSFERENCIA,
        transferencia: { operacion: '1', banco: 'Macro', titular: 'x'.repeat(101) },
      },
      ['transferencia', 'titular'],
      'No puede superar los 100 caracteres',
    ],
    [
      'débito sin sus datos',
      { ...DEBITO, debito: undefined },
      ['debito'],
      'Faltan los datos del débito',
    ],
    [
      'débito con monto recibido',
      { ...DEBITO, montoRecibido: 10000 },
      ['montoRecibido'],
      'El monto recibido sólo va en un pago en efectivo',
    ],
    [
      'débito con una red fuera de la lista',
      { ...DEBITO, debito: { ...DEBITO.debito, red: 'AMEX' } },
      ['debito', 'red'],
      'Elegí una red de la lista',
    ],
    [
      'débito con un cupón con letras',
      { ...DEBITO, debito: { ...DEBITO.debito, cupon: '12A' } },
      ['debito', 'cupon'],
      'El cupón sólo puede tener números',
    ],
    [
      'débito con un cupón de más de 20',
      { ...DEBITO, debito: { ...DEBITO.debito, cupon: '1'.repeat(21) } },
      ['debito', 'cupon'],
      'No puede superar los 20 caracteres',
    ],
    [
      'débito con 3 últimos números',
      { ...DEBITO, debito: { ...DEBITO.debito, ultimos4: '123' } },
      ['debito', 'ultimos4'],
      'Tienen que ser exactamente 4 números',
    ],
    [
      'débito con el número completo de la tarjeta',
      { ...DEBITO, debito: { ...DEBITO.debito, ultimos4: '4509123412341234' } },
      ['debito', 'ultimos4'],
      'Tienen que ser exactamente 4 números',
    ],
  ])('%s → 400 en el campo', async (_, datos, path, message) => {
    const res = await pedir('', 'POST', datos)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDACION')
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path, message })]),
    )
    expect(repository.registrar).not.toHaveBeenCalled()
  })

  it('un campo que no es del contrato (formaPagoId) se descarta', async () => {
    const res = await pedir('', 'POST', { ...body, formaPagoId: 99 })
    expect(res.status).toBe(201)
    expect(repository.registrar.mock.calls[0]?.[0]).not.toHaveProperty('formaPagoId')
  })
})

describe('GET /pagos/{id}', () => {
  it('200 con el comprobante y el vuelto recalculado', async () => {
    const res = await pedir('/31')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...comprobante, vuelto: 2000 })
    expect(repository.buscarComprobante).toHaveBeenCalledWith(31)
  })

  it('inexistente → 404 NO_ENCONTRADO', async () => {
    repository.buscarComprobante.mockResolvedValue(null)
    const res = await pedir('/99')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/abc', '/0'])('id inválido %s → 400', async (path) => {
    expect((await pedir(path)).status).toBe(400)
  })
})

describe('GET /pagos/{id}/pdf', { timeout: 30_000 }, () => {
  it('200 con el PDF, en el visor del navegador, con nombre de archivo y sin caché', async () => {
    const res = await pedir('/31/pdf')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="comprobante-1024.pdf"; filename*=UTF-8''comprobante-1024.pdf`,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')

    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Comprobante de pago N° 1024')
    // Los mismos datos que `GET /pagos/{id}`: una sola lectura, sin consultas nuevas.
    expect(repository.buscarComprobante).toHaveBeenCalledExactlyOnceWith(31)
  })

  it('inexistente → 404 NO_ENCONTRADO, en JSON', async () => {
    repository.buscarComprobante.mockResolvedValue(null)
    const res = await pedir('/99/pdf')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO')
  })

  it.each(['/abc/pdf', '/0/pdf', '/1.5/pdf'])(
    'id inválido %s → 400 VALIDACION, en JSON',
    async (path) => {
      const res = await pedir(path)

      expect(res.status).toBe(400)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect((await res.json()).error.code).toBe('VALIDACION')
      expect(repository.buscarComprobante).not.toHaveBeenCalled()
    },
  )
})

describe('OpenAPI', () => {
  it('declara todos los status codes de cada endpoint', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    expect(Object.keys(doc.paths?.['/api/v1/pagos']?.post?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
    ])
    expect(Object.keys(doc.paths?.['/api/v1/pagos/{id}']?.get?.responses ?? {}).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
    ])
    expect(Object.keys(doc.paths?.['/api/v1/pagos/{id}/pdf']?.get?.responses ?? {}).sort()).toEqual(
      ['200', '400', '401', '403', '404'],
    )
  })

  it('el PDF se declara como binario `application/pdf`', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const respuesta = doc.paths?.['/api/v1/pagos/{id}/pdf']?.get?.responses?.['200']
    expect(respuesta).toMatchObject({
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
    })
  })
})
