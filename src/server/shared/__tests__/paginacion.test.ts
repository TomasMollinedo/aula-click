import { createRoute, z } from '@hono/zod-openapi'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { ErrorResponseSchema, errorHandler } from '@/server/errors'
import { createRouter } from '@/server/router'
import {
  armarMeta,
  calcularSkipTake,
  paginacionQuerySchema,
  paginatedSchema,
  type PaginacionQuery,
} from '../paginacion'

describe('paginacionQuerySchema', () => {
  it('sin parámetros usa page 1 y pageSize 20', () => {
    expect(paginacionQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })

  it('coerciona los strings del query', () => {
    expect(paginacionQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    })
  })

  it('acepta pageSize 100 y rechaza 101 (no lo recorta)', () => {
    expect(paginacionQuerySchema.parse({ pageSize: '100' }).pageSize).toBe(100)
    expect(paginacionQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
  })

  it.each(['0', '-1', 'abc', '1.5'])('rechaza page %s', (page) => {
    expect(paginacionQuerySchema.safeParse({ page }).success).toBe(false)
  })

  it('da mensajes en español', () => {
    const resultado = paginacionQuerySchema.safeParse({ pageSize: '101' })
    expect(resultado.error?.issues[0]?.message).toBe('Debe ser menor o igual a 100')
  })

  it('la salida es { page: number; pageSize: number }', () => {
    expectTypeOf<PaginacionQuery>().toEqualTypeOf<{ page: number; pageSize: number }>()
  })

  it('.extend y .merge mantienen los defaults y los tipos', () => {
    const extendido = paginacionQuerySchema.extend({ q: z.string().optional() })
    const unido = paginacionQuerySchema.merge(z.object({ estado: z.string().optional() }))
    expect(extendido.parse({ q: 'ana' })).toEqual({ page: 1, pageSize: 20, q: 'ana' })
    expect(unido.parse({})).toEqual({ page: 1, pageSize: 20 })
    expectTypeOf<z.infer<typeof extendido>>().toEqualTypeOf<{
      page: number
      pageSize: number
      q?: string | undefined
    }>()
  })
})

describe('calcularSkipTake', () => {
  it('página 1 no saltea nada', () => {
    expect(calcularSkipTake({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 })
  })

  it('página 3 de 20 saltea 40', () => {
    expect(calcularSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 })
  })
})

describe('armarMeta', () => {
  it.each([
    [0, 0],
    [57, 3],
    [60, 3],
    [61, 4],
  ])('total %i con pageSize 20 da %i páginas', (total, totalPages) => {
    expect(armarMeta({ page: 1, pageSize: 20 }, total)).toEqual({
      page: 1,
      pageSize: 20,
      total,
      totalPages,
    })
  })
})

describe('paginatedSchema', () => {
  const schema = paginatedSchema(z.object({ id: z.number() }))
  const meta = { page: 1, pageSize: 20, total: 2, totalPages: 1 }

  it('parsea { data, meta }', () => {
    expect(schema.parse({ data: [{ id: 1 }, { id: 2 }], meta })).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta,
    })
  })

  it('rechaza un meta incompleto', () => {
    expect(schema.safeParse({ data: [], meta: { page: 1, pageSize: 20 } }).success).toBe(false)
  })

  it('tiene la forma de PaginatedResponse<T> del frontend', () => {
    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<{
      data: { id: number }[]
      meta: { page: number; pageSize: number; total: number; totalPages: number }
    }>()
  })
})

describe('paginacionQuerySchema en un router', () => {
  const app = createRouter()
  app.onError(errorHandler)
  app.openapi(
    createRoute({
      method: 'get',
      path: '/x',
      request: { query: paginacionQuerySchema },
      responses: {
        200: {
          description: 'Query validado',
          content: {
            'application/json': { schema: z.object({ page: z.number(), pageSize: z.number() }) },
          },
        },
      },
    }),
    (c) => c.json(c.req.valid('query'), 200),
  )

  it('un query inválido responde 400 VALIDACION', async () => {
    const res = await app.request('/x?pageSize=101')
    expect(res.status).toBe(400)
    expect(ErrorResponseSchema.parse(await res.json()).error.code).toBe('VALIDACION')
  })

  it('sin query responde 200 con los defaults', async () => {
    const res = await app.request('/x')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ page: 1, pageSize: 20 })
  })
})
