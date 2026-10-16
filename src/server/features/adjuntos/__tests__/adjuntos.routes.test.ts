import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { adjuntosRoutes } from '../adjuntos.routes'

// Contrato HTTP de adjuntos (T-95): validación del multipart (tipo, firma y tamaño con
// `archivoSchema`), auth y OpenAPI. Sin base ni MinIO: el repository y Better Auth son mocks.

const { repository, getSession, getPresignedUrl } = vi.hoisted(() => ({
  repository: {
    subir: vi.fn(),
    leerPago: vi.fn(),
    ultimo: vi.fn(),
    reemplazar: vi.fn(),
    quitar: vi.fn(),
    existeLiquidacion: vi.fn(),
    ultimoDeLiquidacion: vi.fn(),
  },
  getSession: vi.fn(),
  getPresignedUrl: vi.fn(),
}))
vi.mock('../adjuntos.repository', () => ({ adjuntosRepository: repository }))
vi.mock('@/lib/storage', () => ({ getPresignedUrl, putObject: vi.fn(), deleteObject: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const app = createRouter().basePath('/api/v1')
app.onError(errorHandler)
app.route('/adjuntos', adjuntosRoutes)

const MB = 1024 * 1024
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const FIRMA_JPG = [0xff, 0xd8, 0xff]

/** Un archivo con esa firma al principio, del tamaño pedido (el resto en ceros). */
function archivo(nombre: string, tipo: string, firma: number[], bytes = 1024) {
  const contenido = new Uint8Array(Math.max(bytes, firma.length))
  contenido.set(firma)
  return new File([contenido], nombre, { type: tipo })
}

function sesion(role = 'MESA_ENTRADAS', extra: Record<string, unknown> = {}) {
  return {
    headers: new Headers(),
    response: {
      user: { id: 'usr_mesa', role, estado: 'ACTIVO', ...extra },
      session: { id: 's-1' },
    },
  }
}

function subir(file?: File) {
  const form = new FormData()
  if (file) form.append('archivo', file)
  return app.request('/api/v1/adjuntos', { method: 'POST', body: form })
}

const ULTIMO = {
  id: 21,
  archivoKey: 'adjuntos/abc.pdf',
  nombre: 'cupón.pdf',
  tipo: 'application/pdf',
  bytes: 2048,
  adjuntadoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  adjuntadoEl: '2026-10-14T13:45:00.000Z',
}

function pedir(path: string, metodo = 'GET', form?: FormData) {
  return app.request(`/api/v1/adjuntos${path}`, { method: metodo, body: form })
}

function formCon(file: File) {
  const form = new FormData()
  form.append('archivo', file)
  return form
}

async function errorDe(res: Response) {
  const body = await res.json()
  return { code: body.error.code, details: body.error.details }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
  repository.leerPago.mockResolvedValue({ estado: 'VIGENTE', tipoFormaPago: 'DEBITO' })
  repository.ultimo.mockResolvedValue(ULTIMO)
  repository.reemplazar.mockResolvedValue(undefined)
  repository.quitar.mockResolvedValue(1)
  repository.existeLiquidacion.mockResolvedValue(true)
  repository.ultimoDeLiquidacion.mockResolvedValue(ULTIMO)
  getPresignedUrl.mockResolvedValue('https://minio.local/firmada')
  repository.subir.mockImplementation(
    async (guardar: { nombre: string; tipo: string; bytes: Uint8Array }) => ({
      id: 18,
      nombre: guardar.nombre,
      tipo: guardar.tipo,
      bytes: guardar.bytes.byteLength,
    }),
  )
})

describe('POST /adjuntos', () => {
  it.each([
    ['transferencia.pdf', 'application/pdf', FIRMA_PDF],
    ['cupon.png', 'image/png', FIRMA_PNG],
    ['cupon.jpg', 'image/jpeg', FIRMA_JPG],
  ])('%s → 201 con id, nombre, tipo y bytes; pasa el actor', async (nombre, tipo, firma) => {
    const res = await subir(archivo(nombre, tipo, firma, 2048))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 18, nombre, tipo, bytes: 2048 })
    expect(repository.subir).toHaveBeenCalledWith(
      expect.objectContaining({ nombre, tipo }),
      expect.objectContaining({ userId: 'usr_mesa', role: 'MESA_ENTRADAS' }),
    )
  })

  it('un PDF de exactamente 5 MB se acepta', async () => {
    const res = await subir(archivo('justo.pdf', 'application/pdf', FIRMA_PDF, 5 * MB))
    expect(res.status).toBe(201)
  })

  it('un PDF de 6 MB → 400 "El archivo supera los 5 MB", sin subir nada', async () => {
    const res = await subir(archivo('grande.pdf', 'application/pdf', FIRMA_PDF, 6 * MB))

    expect(res.status).toBe(400)
    expect(await errorDe(res)).toEqual({
      code: 'VALIDACION',
      details: [
        expect.objectContaining({ path: ['archivo'], message: 'El archivo supera los 5 MB' }),
      ],
    })
    expect(repository.subir).not.toHaveBeenCalled()
  })

  it.each([
    ['otro tipo (GIF)', archivo('foto.gif', 'image/gif', [0x47, 0x49, 0x46])],
    [
      'un PNG renombrado a .pdf (la firma no coincide)',
      archivo('trucho.pdf', 'application/pdf', FIRMA_PNG),
    ],
    ['un texto con tipo de imagen', archivo('nota.jpg', 'image/jpeg', [0x68, 0x6f, 0x6c, 0x61])],
  ])('%s → 400 "El archivo debe ser JPG, PNG o PDF"', async (_caso, file) => {
    const res = await subir(file)

    expect(res.status).toBe(400)
    expect((await errorDe(res)).details).toEqual([
      expect.objectContaining({ path: ['archivo'], message: 'El archivo debe ser JPG, PNG o PDF' }),
    ])
    expect(repository.subir).not.toHaveBeenCalled()
  })

  it('sin el campo archivo → 400', async () => {
    expect((await subir()).status).toBe(400)
    expect(repository.subir).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await subir(archivo('a.pdf', 'application/pdf', FIRMA_PDF))).status).toBe(401)
  })

  it('como GERENTE (comprobante de la transferencia a un profesor) → 201; pasa el actor', async () => {
    getSession.mockResolvedValue(sesion('GERENTE', { id: 'usr_gerente' }))

    const res = await subir(archivo('transferencia.pdf', 'application/pdf', FIRMA_PDF))

    expect(res.status).toBe(201)
    expect(repository.subir).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'transferencia.pdf' }),
      expect.objectContaining({ userId: 'usr_gerente', role: 'GERENTE' }),
    )
  })

  it.each([
    ['PROFESOR', {}],
    ['ALUMNO', { alumnoId: 5 }],
  ])('con rol %s → 403', async (rol, extra) => {
    getSession.mockResolvedValue(sesion(rol, extra))
    expect((await subir(archivo('a.pdf', 'application/pdf', FIRMA_PDF))).status).toBe(403)
    expect(repository.subir).not.toHaveBeenCalled()
  })
})

describe('GET /adjuntos/pagos/{pagoId}', () => {
  it.each(['MESA_ENTRADAS', 'GERENTE'])(
    '%s → 200 con la URL inline (con el nombre) y sin la clave',
    async (rol) => {
      getSession.mockResolvedValue(sesion(rol))
      const res = await pedir('/pagos/30')

      expect(res.status).toBe(200)
      const { archivoKey, ...visible } = ULTIMO
      expect(await res.json()).toEqual({ ...visible, url: 'https://minio.local/firmada' })
      expect(getPresignedUrl).toHaveBeenCalledWith(archivoKey, undefined, {
        inline: { nombreArchivo: 'cupón.pdf' },
      })
    },
  )

  it('el alumno no lo ve → 403', async () => {
    getSession.mockResolvedValue(sesion('ALUMNO', { alumnoId: 5 }))
    expect((await pedir('/pagos/30')).status).toBe(403)
    expect(repository.ultimo).not.toHaveBeenCalled()
  })

  it('sin adjunto → 404', async () => {
    repository.ultimo.mockResolvedValue(null)
    expect((await pedir('/pagos/30')).status).toBe(404)
  })

  it.each(['/pagos/abc', '/pagos/0'])('%s → 400', async (path) => {
    expect((await pedir(path)).status).toBe(400)
  })
})

describe('GET /adjuntos/liquidaciones/{liquidacionId}', () => {
  beforeEach(() => getSession.mockResolvedValue(sesion('GERENTE')))

  it('GERENTE → 200 con la URL inline y sin la clave', async () => {
    const res = await pedir('/liquidaciones/7')

    expect(res.status).toBe(200)
    const { archivoKey, ...visible } = ULTIMO
    expect(await res.json()).toEqual({ ...visible, url: 'https://minio.local/firmada' })
    expect(repository.ultimoDeLiquidacion).toHaveBeenCalledWith(7)
    expect(getPresignedUrl).toHaveBeenCalledWith(archivoKey, undefined, {
      inline: { nombreArchivo: 'cupón.pdf' },
    })
  })

  it.each([
    ['MESA_ENTRADAS', {}],
    ['PROFESOR', {}],
    ['ALUMNO', { alumnoId: 5 }],
  ])('%s → 403, sin leer nada', async (rol, extra) => {
    getSession.mockResolvedValue(sesion(rol, extra))

    expect((await pedir('/liquidaciones/7')).status).toBe(403)
    expect(repository.existeLiquidacion).not.toHaveBeenCalled()
    expect(repository.ultimoDeLiquidacion).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    expect((await pedir('/liquidaciones/7')).status).toBe(401)
  })

  it.each(['/liquidaciones/abc', '/liquidaciones/0'])('%s → 400', async (path) => {
    expect((await pedir(path)).status).toBe(400)
  })

  it('liquidación inexistente → 404 "Liquidación no encontrada"', async () => {
    repository.existeLiquidacion.mockResolvedValue(false)
    const res = await pedir('/liquidaciones/7')

    expect(res.status).toBe(404)
    expect((await res.json()).error.message).toBe('Liquidación no encontrada')
  })

  it('sin adjunto → 404 "La liquidación no tiene comprobante adjunto"', async () => {
    repository.ultimoDeLiquidacion.mockResolvedValue(null)
    const res = await pedir('/liquidaciones/7')

    expect(res.status).toBe(404)
    expect((await res.json()).error.message).toBe('La liquidación no tiene comprobante adjunto')
  })
})

describe('PUT /adjuntos/pagos/{pagoId}', () => {
  it('reemplaza → 200 con el adjunto que queda', async () => {
    const res = await pedir(
      '/pagos/31',
      'PUT',
      formCon(archivo('nuevo.pdf', 'application/pdf', FIRMA_PDF)),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(21)
    expect(repository.reemplazar).toHaveBeenCalledWith(
      31,
      expect.objectContaining({ nombre: 'nuevo.pdf', tipo: 'application/pdf' }),
      expect.objectContaining({ userId: 'usr_mesa' }),
    )
  })

  it('archivo inválido → 400, sin reemplazar', async () => {
    const res = await pedir(
      '/pagos/31',
      'PUT',
      formCon(archivo('x.pdf', 'application/pdf', FIRMA_PNG)),
    )
    expect(res.status).toBe(400)
    expect(repository.reemplazar).not.toHaveBeenCalled()
  })

  it('pago anulado → 409 PAGO_ANULADO', async () => {
    repository.leerPago.mockResolvedValue({ estado: 'ANULADO', tipoFormaPago: 'DEBITO' })
    const res = await pedir(
      '/pagos/31',
      'PUT',
      formCon(archivo('x.pdf', 'application/pdf', FIRMA_PDF)),
    )
    expect(res.status).toBe(409)
    expect((await errorDe(res)).code).toBe('PAGO_ANULADO')
  })

  it('el gerente no reemplaza → 403', async () => {
    getSession.mockResolvedValue(sesion('GERENTE'))
    const res = await pedir(
      '/pagos/31',
      'PUT',
      formCon(archivo('x.pdf', 'application/pdf', FIRMA_PDF)),
    )
    expect(res.status).toBe(403)
  })
})

describe('DELETE /adjuntos/pagos/{pagoId}', () => {
  it('en débito → 204 sin cuerpo', async () => {
    const res = await pedir('/pagos/31', 'DELETE')

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(repository.quitar).toHaveBeenCalledWith(
      31,
      expect.objectContaining({ userId: 'usr_mesa' }),
    )
  })

  it('por transferencia → 409 ADJUNTO_OBLIGATORIO con el mensaje de HU-24', async () => {
    repository.leerPago.mockResolvedValue({ estado: 'VIGENTE', tipoFormaPago: 'TRANSFERENCIA' })
    const res = await pedir('/pagos/30', 'DELETE')

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toEqual({
      code: 'ADJUNTO_OBLIGATORIO',
      message: 'Un pago por transferencia no puede quedar sin comprobante: reemplazalo',
    })
  })

  it('el gerente no quita → 403', async () => {
    getSession.mockResolvedValue(sesion('GERENTE'))
    expect((await pedir('/pagos/31', 'DELETE')).status).toBe(403)
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  const status = (metodo: 'get' | 'put' | 'delete') =>
    Object.keys(doc.paths['/api/v1/adjuntos/pagos/{pagoId}']?.[metodo]?.responses ?? {}).sort()

  it('declara GET, PUT y DELETE de un pago con todos sus status codes', () => {
    expect(status('get')).toEqual(['200', '400', '401', '403', '404'])
    expect(status('put')).toEqual(['200', '400', '401', '403', '404', '409'])
    expect(status('delete')).toEqual(['204', '400', '401', '403', '404', '409'])
  })

  it('declara GET de una liquidación con todos sus status codes', () => {
    expect(
      Object.keys(
        doc.paths['/api/v1/adjuntos/liquidaciones/{liquidacionId}']?.get?.responses ?? {},
      ).sort(),
    ).toEqual(['200', '400', '401', '403', '404'])
  })

  it('declara POST /adjuntos con todos sus status codes y sus componentes', () => {
    expect(Object.keys(doc.paths['/api/v1/adjuntos']?.post?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
    ])
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'AdjuntoSubido',
        'SubirAdjunto',
        'AdjuntoDePago',
        'AdjuntoDeLiquidacion',
        'ReemplazarAdjunto',
      ]),
    )
  })
})
