import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { contarPaginas, metadato } from '@/server/shared/__tests__/pdf-inspeccion'
import { cajaRoutes } from '../caja.routes'

// Contrato HTTP de la caja (T-127): validación de Zod, auth y OpenAPI. Sin base ni variables de
// entorno: el repository y Better Auth se reemplazan por mocks. Las cuentas se prueban en las reglas
// y en el service.

const { repository, getSession } = vi.hoisted(() => ({
  repository: {
    cobrosDelDia: vi.fn(),
    anulacionesDelDia: vi.fn(),
    pagosAProfesoresDelDia: vi.fn(),
  },
  getSession: vi.fn(),
}))
vi.mock('../caja.repository', () => ({ cajaRepository: repository }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/caja', cajaRoutes)

function sesion(role = 'GERENTE') {
  return {
    headers: new Headers(),
    response: {
      user: {
        id: 'usr_gerente',
        name: 'Ricardo Gerente',
        nombre: 'Ricardo',
        apellido: 'Gerente',
        role,
        estado: 'ACTIVO',
      },
      session: { id: 's-1' },
    },
  }
}

const FECHA = '2020-01-06'
const pedir = (query = `?fecha=${FECHA}`) => app.request(`/api/v1/caja${query}`)
const pedirPdf = (query = `?fecha=${FECHA}`) => app.request(`/api/v1/caja/pdf${query}`)

const EFECTIVO = { codigo: 'EFECTIVO', nombre: 'Efectivo' }
const TRANSFERENCIA = { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' }

const pago = {
  pagoId: 31,
  numeroComprobante: 1024,
  registradoEl: '2020-01-06T13:00:00.000Z',
  alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
  formaPago: EFECTIVO,
  importe: 8000,
  turnos: [{ importe: 8000, porcentaje: 15 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.cobrosDelDia.mockResolvedValue([{ ...pago, estado: 'ANULADO' }])
  repository.anulacionesDelDia.mockResolvedValue([
    {
      ...pago,
      registradoEl: '2020-01-06T14:00:00.000Z',
      motivo: 'ERROR_CARGA',
      detalle: null,
    },
  ])
  repository.pagosAProfesoresDelDia.mockResolvedValue([
    {
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2019-12',
      numeroOperacion: '0048213',
      formaPago: TRANSFERENCIA,
      importe: 6800,
      registradoEl: '2020-01-06T15:00:00.000Z',
    },
  ])
})

function ningunaLectura() {
  for (const lectura of Object.values(repository)) expect(lectura).not.toHaveBeenCalled()
}

describe.each([
  ['GET /caja', pedir],
  ['GET /caja/pdf', pedirPdf],
])('auth de %s', (_nombre, pedirAlgo) => {
  it('sin sesión → 401 NO_AUTENTICADO', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    const res = await pedirAlgo()

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO')
    ningunaLectura()
  })

  it.each(['MESA_ENTRADAS', 'PROFESOR', 'ALUMNO'])('con %s → 403 SIN_PERMISO', async (role) => {
    getSession.mockResolvedValue(sesion(role))
    const res = await pedirAlgo()

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SIN_PERMISO')
    ningunaLectura()
  })
})

describe('GET /caja', () => {
  it('con GERENTE → 200 con los movimientos por hora y el resumen', async () => {
    const res = await pedir()

    expect(res.status).toBe(200)
    expect(await res.json()).toStrictEqual({
      fecha: FECHA,
      movimientos: [
        {
          tipo: 'COBRO',
          registradoEl: '2020-01-06T13:00:00.000Z',
          pagoId: 31,
          numeroComprobante: 1024,
          alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
          formaPago: EFECTIVO,
          importe: 8000,
          estado: 'ANULADO',
        },
        {
          tipo: 'ANULACION',
          registradoEl: '2020-01-06T14:00:00.000Z',
          pagoId: 31,
          numeroComprobante: 1024,
          alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
          formaPago: EFECTIVO,
          importe: 8000,
          motivo: 'ERROR_CARGA',
          detalle: null,
        },
        {
          tipo: 'PAGO_PROFESOR',
          registradoEl: '2020-01-06T15:00:00.000Z',
          profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
          mes: '2019-12',
          numeroOperacion: '0048213',
          formaPago: TRANSFERENCIA,
          importe: 6800,
          liquidacion: { profesorId: 4, mes: '2019-12' },
        },
      ],
      resumen: {
        ingresos: {
          porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
          total: 0,
          parteCentro: 0,
          parteProfesores: 0,
        },
        egresos: 6800,
        saldo: -6800,
      },
    })
  })

  it('la fecha llega tal cual a las tres lecturas', async () => {
    await pedir()

    expect(repository.cobrosDelDia).toHaveBeenCalledExactlyOnceWith(FECHA)
    expect(repository.anulacionesDelDia).toHaveBeenCalledExactlyOnceWith(FECHA)
    expect(repository.pagosAProfesoresDelDia).toHaveBeenCalledExactlyOnceWith(FECHA)
  })

  it('sin fecha → la de hoy', async () => {
    const res = await pedir('')

    expect(res.status).toBe(200)
    const { fecha } = await res.json()
    expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(repository.cobrosDelDia).toHaveBeenCalledExactlyOnceWith(fecha)
  })

  it('un día sin movimientos → 200 con las listas vacías y el resumen en 0', async () => {
    repository.cobrosDelDia.mockResolvedValue([])
    repository.anulacionesDelDia.mockResolvedValue([])
    repository.pagosAProfesoresDelDia.mockResolvedValue([])

    const res = await pedir()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      movimientos: [],
      resumen: { ingresos: { total: 0 }, egresos: 0, saldo: 0 },
    })
  })

  it('`tipo` y `formaPago` filtran los movimientos y no el resumen', async () => {
    const res = await pedir(`?fecha=${FECHA}&tipo=PAGO_PROFESOR&formaPago=TRANSFERENCIA`)

    const cuerpo = await res.json()
    expect(res.status).toBe(200)
    expect(cuerpo.movimientos.map((m: { tipo: string }) => m.tipo)).toEqual(['PAGO_PROFESOR'])
    expect(cuerpo.resumen.egresos).toBe(6800)
  })

  it('una fecha futura → 400 VALIDACION en `fecha`, sin leer nada', async () => {
    const res = await pedir('?fecha=2999-01-01')

    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDACION')
    expect(error.details).toEqual([
      { path: ['fecha'], message: 'No se puede consultar la caja de una fecha futura' },
    ])
    ningunaLectura()
  })

  it.each([
    ['una fecha que no existe', '?fecha=2026-02-30', 'fecha'],
    ['una fecha con otro formato', '?fecha=15/10/2026', 'fecha'],
    ['un tipo desconocido', `?fecha=${FECHA}&tipo=DEPOSITO`, 'tipo'],
    ['una forma de pago desconocida', `?fecha=${FECHA}&formaPago=CHEQUE`, 'formaPago'],
  ])('%s → 400 VALIDACION en `%s`', async (_caso, query, campo) => {
    const res = await pedir(query)

    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDACION')
    expect(error.details[0].path).toEqual([campo])
    ningunaLectura()
  })

  it('OpenAPI: declara sus status codes, los parámetros opcionales y los componentes', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const get = doc.paths?.['/api/v1/caja']?.get

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
      { name: 'fecha', required: false },
      { name: 'tipo', required: false },
      { name: 'formaPago', required: false },
    ])
    for (const nombre of [
      'Caja',
      'MovimientoCaja',
      'MovimientoCajaCobro',
      'MovimientoCajaAnulacion',
      'MovimientoCajaPagoProfesor',
      'ResumenCaja',
    ]) {
      expect(doc.components?.schemas?.[nombre]).toBeDefined()
    }
  })
})

describe('GET /caja/pdf', { timeout: 30_000 }, () => {
  it('con GERENTE → 200 con el PDF y los headers del contrato común', async () => {
    const res = await pedirPdf()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="caja-${FECHA}.pdf"; filename*=UTF-8''caja-${FECHA}.pdf`,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    const pdf = Buffer.from(await res.arrayBuffer())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Caja diaria 06/01/2020')
  })

  it('sin fecha → la caja de hoy, con la fecha en el nombre del archivo', async () => {
    const res = await pedirPdf('')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(/filename="caja-\d{4}-\d{2}-\d{2}\.pdf"/)
  })

  it('una fecha futura o inválida → 400 en JSON', async () => {
    for (const query of ['?fecha=2999-01-01', '?fecha=ayer']) {
      const res = await pedirPdf(query)

      expect(res.status).toBe(400)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect((await res.json()).error.code).toBe('VALIDACION')
    }
    ningunaLectura()
  })

  it('el PDF lleva la lista completa: ignora `tipo` y `formaPago`', async () => {
    const res = await pedirPdf(`?fecha=${FECHA}&tipo=COBRO&formaPago=DEBITO`)

    expect(res.status).toBe(200)
    expect(repository.pagosAProfesoresDelDia).toHaveBeenCalledOnce()
  })

  it('el OpenAPI declara el 200 como application/pdf binario y los errores como JSON', () => {
    const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 't', version: '1' } })
    const get = doc.paths?.['/api/v1/caja/pdf']?.get

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
})
