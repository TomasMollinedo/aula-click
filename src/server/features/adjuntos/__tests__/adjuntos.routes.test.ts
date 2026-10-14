import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { adjuntosRoutes } from '../adjuntos.routes'

// Contrato HTTP de adjuntos (T-95): validación del multipart (tipo, firma y tamaño con
// `archivoSchema`), auth y OpenAPI. Sin base ni MinIO: el repository y Better Auth son mocks.

const { repository, getSession } = vi.hoisted(() => ({
  repository: { subir: vi.fn() },
  getSession: vi.fn(),
}))
vi.mock('../adjuntos.repository', () => ({ adjuntosRepository: repository }))
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

async function errorDe(res: Response) {
  const body = await res.json()
  return { code: body.error.code, details: body.error.details }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(sesion())
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

  it.each([
    ['GERENTE', {}],
    ['PROFESOR', {}],
    ['ALUMNO', { alumnoId: 5 }],
  ])('con rol %s → 403', async (rol, extra) => {
    getSession.mockResolvedValue(sesion(rol, extra))
    expect((await subir(archivo('a.pdf', 'application/pdf', FIRMA_PDF))).status).toBe(403)
    expect(repository.subir).not.toHaveBeenCalled()
  })
})

describe('OpenAPI', () => {
  const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })

  it('declara POST /adjuntos con todos sus status codes y sus componentes', () => {
    expect(Object.keys(doc.paths['/api/v1/adjuntos']?.post?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
    ])
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(['AdjuntoSubido', 'SubirAdjunto']),
    )
  })
})
