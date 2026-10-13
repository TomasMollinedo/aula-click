import { createRoute, z } from '@hono/zod-openapi'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '../../errors'
import { createRouter } from '../../router'
import { archivoSchema, claveDeArchivo } from '../archivos'

const MB = 1024 * 1024

const JPG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]

const MENSAJES = {
  tipo: 'El archivo debe ser JPG, PNG o PDF',
  tamano: 'El archivo supera los 5 MB',
}
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }

const schema = archivoSchema({ tipos: TIPOS, maxBytes: 5 * MB, mensajes: MENSAJES })

function archivo(bytes: number[], nombre: string, tipo: string, relleno = 0) {
  return new File([new Uint8Array([...bytes, ...new Array<number>(relleno).fill(0)])], nombre, {
    type: tipo,
  })
}

async function mensajes(valor: unknown, esquema = schema) {
  const resultado = await esquema.safeParseAsync(valor)
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message)
}

describe('archivoSchema', () => {
  it.each([
    ['un JPG', JPG, 'foto.jpg', 'image/jpeg'],
    ['un PNG', PNG, 'foto.png', 'image/png'],
    ['un PDF', PDF, 'comprobante.pdf', 'application/pdf'],
  ])('acepta %s', async (_nombre, bytes, nombre, tipo) => {
    const valor = archivo(bytes, nombre, tipo)
    const resultado = await schema.safeParseAsync(valor)
    expect(resultado.success).toBe(true)
    expect(resultado.data).toBe(valor)
  })

  it('acepta un archivo de exactamente el tamaño máximo', async () => {
    const valor = archivo(PDF, 'x.pdf', 'application/pdf', 5 * MB - PDF.length)
    expect(valor.size).toBe(5 * MB)
    expect(await mensajes(valor)).toEqual([])
  })

  it('rechaza un PNG renombrado a .pdf, con el mensaje de tipo', async () => {
    expect(await mensajes(archivo(PNG, 'comprobante.pdf', 'application/pdf'))).toEqual([
      MENSAJES.tipo,
    ])
  })

  it('rechaza un PDF que declara ser PNG, y un archivo vacío que declara un tipo permitido', async () => {
    expect(await mensajes(archivo(PDF, 'foto.png', 'image/png'))).toEqual([MENSAJES.tipo])
    expect(await mensajes(archivo([], 'foto.jpg', 'image/jpeg'))).toEqual([MENSAJES.tipo])
  })

  it('rechaza un archivo de más de 5 MB, con el mensaje de tamaño', async () => {
    const grande = archivo(PNG, 'foto.png', 'image/png', 5 * MB)
    expect(grande.size).toBeGreaterThan(5 * MB)
    expect(await mensajes(grande)).toEqual([MENSAJES.tamano])
  })

  it('rechaza un tipo MIME no permitido, aunque tenga una firma conocida', async () => {
    const soloPdf = archivoSchema({
      tipos: { 'application/pdf': 'pdf' },
      maxBytes: MB,
      mensajes: MENSAJES,
    })
    expect(await mensajes(archivo(PNG, 'foto.png', 'image/png'), soloPdf)).toEqual([MENSAJES.tipo])
    expect(await mensajes(archivo(PDF, 'x.exe', 'application/octet-stream'))).toEqual([
      MENSAJES.tipo,
    ])
    expect(await mensajes(archivo(PDF, 'x', ''))).toEqual([MENSAJES.tipo])
  })

  it('con varios problemas informa uno solo: el tipo antes que el tamaño', async () => {
    expect(await mensajes(archivo(PNG, 'x.exe', 'application/zip', 6 * MB))).toEqual([
      MENSAJES.tipo,
    ])
  })

  it('rechaza lo que no es un archivo', async () => {
    expect(await mensajes('foto.png')).toEqual(['Debe subir un archivo'])
    expect(await mensajes(undefined)).toEqual(['Debe subir un archivo'])
  })

  it('usa el mensaje de "requerido" que se le pasa', async () => {
    const propio = archivoSchema({
      tipos: TIPOS,
      maxBytes: MB,
      mensajes: { ...MENSAJES, requerido: 'Falta el comprobante' },
    })
    expect(await mensajes(undefined, propio)).toEqual(['Falta el comprobante'])
  })

  it('falla al armarse si un tipo permitido no tiene firma conocida', () => {
    expect(() =>
      archivoSchema({ tipos: { 'image/gif': 'gif' }, maxBytes: MB, mensajes: MENSAJES }),
    ).toThrow('image/gif')
  })

  it('se declara como archivo binario en el OpenAPI y admite una descripción propia', () => {
    const body = z.object({
      archivo: schema.openapi({ description: 'Comprobante del pago' }),
    })
    const router = createRouter()
    router.openapi(
      createRoute({
        method: 'post',
        path: '/subir',
        request: { body: { content: { 'multipart/form-data': { schema: body } } } },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200),
    )
    const spec = router.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
    })
    const cuerpo = spec.paths['/subir']?.post?.requestBody as {
      content: Record<string, { schema: { properties: Record<string, unknown> } }>
    }
    const propiedad = cuerpo.content['multipart/form-data']?.schema.properties.archivo
    expect(propiedad).toMatchObject({
      type: 'string',
      format: 'binary',
      description: 'Comprobante del pago',
    })
  })

  it('dentro de una ruta, un PNG renombrado a .pdf es un 400 VALIDACION con su mensaje', async () => {
    const router = createRouter()
    router.onError(errorHandler)
    router.openapi(
      createRoute({
        method: 'post',
        path: '/subir',
        request: {
          body: {
            content: { 'multipart/form-data': { schema: z.object({ archivo: schema }) } },
          },
        },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({ ok: true }, 200),
    )
    const enviar = (valor: File) => {
      const form = new FormData()
      form.append('archivo', valor)
      return router.request('/subir', { method: 'POST', body: form })
    }

    expect((await enviar(archivo(PDF, 'ok.pdf', 'application/pdf'))).status).toBe(200)
    const rechazada = await enviar(archivo(PNG, 'falso.pdf', 'application/pdf'))
    expect(rechazada.status).toBe(400)
    expect(await rechazada.json()).toMatchObject({
      error: {
        code: 'VALIDACION',
        details: [{ message: MENSAJES.tipo, path: ['archivo'] }],
      },
    })
  })
})

describe('claveDeArchivo', () => {
  it('arma <carpeta>/<uuid>.<extensión>', () => {
    expect(claveDeArchivo('alumnos/12', 'png')).toMatch(
      /^alumnos\/12\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    )
  })

  it('no repite la clave', () => {
    expect(claveDeArchivo('pagos', 'pdf')).not.toBe(claveDeArchivo('pagos', 'pdf'))
  })
})
