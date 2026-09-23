import { createRoute, z } from '@hono/zod-openapi'
import { describe, expect, it } from 'vitest'
import { ErrorResponseSchema, errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import { MAX_TERMINOS, normalizarBusqueda, qBusqueda, Q_MAX, terminosDeBusqueda } from '../busqueda'
import { paginacionQuerySchema } from '../paginacion'

describe('normalizarBusqueda', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizarBusqueda('González')).toBe('gonzalez')
  })

  it('quita la virgulilla de la ñ y colapsa y recorta espacios', () => {
    expect(normalizarBusqueda('  Ñandú  Pérez ')).toBe('nandu perez')
  })

  it('hace chocar "Matemática" con "matematica"', () => {
    expect(normalizarBusqueda('Matemática')).toBe(normalizarBusqueda('matematica'))
  })

  it('quita la diéresis', () => {
    expect(normalizarBusqueda('Güemes')).toBe('guemes')
  })

  it('devuelve "" con un texto vacío', () => {
    expect(normalizarBusqueda('')).toBe('')
  })

  it('no altera un DNI con puntos salvo los espacios', () => {
    expect(normalizarBusqueda('30.123.456')).toBe('30.123.456')
    expect(normalizarBusqueda(' 30.123.456 ')).toBe('30.123.456')
  })

  it.each(['González', '  Ñandú  Pérez ', 'Güemes', 'ya normalizado'])(
    'es idempotente (%o)',
    (texto) => {
      const normalizado = normalizarBusqueda(texto)
      expect(normalizarBusqueda(normalizado)).toBe(normalizado)
    },
  )
})

describe('terminosDeBusqueda', () => {
  it.each([
    ['  GONZÁLEZ ', ['gonzalez']],
    ['gonz', ['gonz']],
    ['juan  gonz', ['juan', 'gonz']],
    ['Juan González', ['juan', 'gonzalez']],
    ['30.123', ['30123']],
    ['30.123.456', ['30123456']],
    ['Ñandú', ['nandu']],
  ])('%o → %o', (q, terminos) => {
    expect(terminosDeBusqueda(q)).toEqual(terminos)
  })

  it.each([undefined, '', '   ', '...', ' . . '])('sin palabras (%o) → []', (q) => {
    expect(terminosDeBusqueda(q)).toEqual([])
  })

  it(`usa solo las primeras ${MAX_TERMINOS} palabras`, () => {
    expect(terminosDeBusqueda('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('cada término coincide con la columna busqueda del registro buscado', () => {
    const busqueda = normalizarBusqueda('González Juan 30123456')
    for (const q of ['gonz', 'GONZALEZ', 'juan gonz', '30.123']) {
      expect(terminosDeBusqueda(q).every((termino) => busqueda.includes(termino))).toBe(true)
    }
  })
})

describe('qBusqueda', () => {
  const schema = z.object({ q: qBusqueda })

  it('es opcional y recorta', () => {
    expect(schema.parse({})).toEqual({})
    expect(schema.parse({ q: '  gonz  ' })).toEqual({ q: 'gonz' })
  })

  it(`acepta ${Q_MAX} caracteres y rechaza ${Q_MAX + 1} con mensaje en español`, () => {
    expect(schema.safeParse({ q: 'a'.repeat(Q_MAX) }).success).toBe(true)
    const resultado = schema.safeParse({ q: 'a'.repeat(Q_MAX + 1) })
    expect(resultado.error?.issues[0]?.message).toBe(`No puede superar los ${Q_MAX} caracteres`)
  })

  it('mide el largo después del trim', () => {
    expect(schema.safeParse({ q: ` ${'a'.repeat(Q_MAX)} ` }).success).toBe(true)
  })
})

describe('qBusqueda en un router', () => {
  const app = createRouter()
  app.onError(errorHandler)
  app.openapi(
    createRoute({
      method: 'get',
      path: '/x',
      request: {
        query: paginacionQuerySchema.extend({
          q: qBusqueda.openapi({ description: 'Búsqueda por apellido y nombre' }),
        }),
      },
      responses: {
        200: {
          description: 'Términos',
          content: { 'application/json': { schema: z.object({ terminos: z.array(z.string()) }) } },
        },
      },
    }),
    (c) => c.json({ terminos: terminosDeBusqueda(c.req.valid('query').q) }, 200),
  )

  it('extiende la paginación y llega a terminosDeBusqueda', async () => {
    const res = await app.request('/x?q=Juan%20GONZ%C3%81LEZ')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ terminos: ['juan', 'gonzalez'] })
  })

  it('un q demasiado largo responde 400 VALIDACION', async () => {
    const res = await app.request(`/x?q=${'a'.repeat(Q_MAX + 1)}`)
    expect(res.status).toBe(400)
    expect(ErrorResponseSchema.parse(await res.json()).error.code).toBe('VALIDACION')
  })

  it('en el OpenAPI es el parámetro q, con la descripción que agrega la feature', () => {
    const doc = app.getOpenAPIDocument({ openapi: '3.0.0', info: { title: 't', version: '1' } })
    const q = doc.paths['/x']?.get?.parameters?.find(
      (parametro) => 'name' in parametro && parametro.name === 'q',
    )
    expect(q).toMatchObject({ in: 'query', description: 'Búsqueda por apellido y nombre' })
  })
})
