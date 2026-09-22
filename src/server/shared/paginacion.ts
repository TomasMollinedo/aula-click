import { z } from '@hono/zod-openapi'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

// Enteros positivos que llegan como string en el query (`?page=2`).
const enteroQuery = z.coerce
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .min(1, { error: 'Debe ser mayor o igual a 1' })

/**
 * Query de paginación: `page` (entero >= 1, default 1) y `pageSize` (entero 1..100, default 20).
 * Entrada: strings del query. Salida: `{ page: number; pageSize: number }`.
 * Un `pageSize` mayor a 100 se rechaza (400), no se recorta.
 * Las features lo extienden con `.extend({ q, estado, ... })`.
 */
export const paginacionQuerySchema = z.object({
  page: enteroQuery.default(1).openapi({
    param: { name: 'page', in: 'query' },
    description: 'Número de página (desde 1)',
    example: 1,
  }),
  pageSize: enteroQuery
    .max(PAGE_SIZE_MAX, { error: `Debe ser menor o igual a ${PAGE_SIZE_MAX}` })
    .default(PAGE_SIZE_DEFAULT)
    .openapi({
      param: { name: 'pageSize', in: 'query' },
      description: `Resultados por página (1 a ${PAGE_SIZE_MAX})`,
      example: PAGE_SIZE_DEFAULT,
    }),
})

/** Query de paginación ya validado: `{ page, pageSize }`. */
export type PaginacionQuery = z.infer<typeof paginacionQuerySchema>

const enteroNoNegativo = z.number().int().min(0)

/**
 * `meta` de toda respuesta paginada: `{ page, pageSize, total, totalPages }`.
 * Componente OpenAPI `MetaPaginacion`.
 */
export const metaPaginacionSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: enteroNoNegativo,
    totalPages: enteroNoNegativo,
  })
  .openapi('MetaPaginacion')

/** `meta` de una respuesta paginada. */
export type MetaPaginacion = z.infer<typeof metaPaginacionSchema>

/**
 * Respuesta de un listado: `{ data: Item[], meta }` (igual a `PaginatedResponse<T>` del frontend).
 * Sin nombre de componente: el envoltorio cambia con cada ítem.
 */
export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({ data: z.array(itemSchema), meta: metaPaginacionSchema })
}

/** `{ page, pageSize }` → `{ skip, take }` para `findMany` de Prisma. */
export function calcularSkipTake(query: { page: number; pageSize: number }): {
  skip: number
  take: number
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize }
}

/** `{ page, pageSize }` y el total de resultados → `meta` (`totalPages` es 0 si no hay resultados). */
export function armarMeta(
  query: { page: number; pageSize: number },
  total: number,
): MetaPaginacion {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  }
}
