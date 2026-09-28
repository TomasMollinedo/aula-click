import { z } from '@hono/zod-openapi'

// Búsqueda sin tildes y por palabras (docs/convenciones-backend.md → Búsqueda sin tildes).

// Diacríticos combinantes (tildes, diéresis, virgulilla de la ñ) que quedan sueltos tras NFD.
// Rango explícito en lugar de \p{M}: el tsconfig apunta a ES2017.
const DIACRITICOS = /[̀-ͯ]/g

/** Largo máximo de `q`, medido después del trim. */
export const Q_MAX = 100
/** Cantidad de palabras de `q` que se usan; el resto se ignora. */
export const MAX_TERMINOS = 5

/**
 * Texto de búsqueda sin mayúsculas ni tildes, con los espacios colapsados.
 * Se usa al guardar la columna `busqueda` y al normalizar el `q` de los listados.
 */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * `q` → palabras para buscar en la columna `busqueda`: normalizado con `normalizarBusqueda`, sin
 * puntos (`30.123` encuentra el DNI `30123456`) y hasta `MAX_TERMINOS` palabras. Sin `q`, o si no
 * queda ninguna palabra, devuelve `[]` (sin filtro). El repository hace un `contains` por palabra,
 * combinados con AND: `"juan gonz"` → `['juan', 'gonz']` encuentra a "González, Juan".
 */
export function terminosDeBusqueda(q: string | undefined): string[] {
  if (!q) return []
  return normalizarBusqueda(q.replace(/\./g, ''))
    .split(' ')
    .filter((termino) => termino !== '')
    .slice(0, MAX_TERMINOS)
}

/**
 * Campo `q` del query de un listado: texto opcional, recortado, de hasta `Q_MAX` caracteres.
 * Se agrega con `paginacionQuerySchema.extend({ q: qBusqueda })`; cada feature puede sumar sobre
 * qué campos busca con `.openapi({ description })`. Su salida va a `terminosDeBusqueda`.
 */
export const qBusqueda = z
  .string({ error: 'Debe ser un texto' })
  .trim()
  .max(Q_MAX, { error: `No puede superar los ${Q_MAX} caracteres` })
  .optional()
  .openapi({
    param: { name: 'q', in: 'query' },
    description: `Búsqueda por palabras: cada una coincide en forma parcial y todas deben coincidir. No distingue mayúsculas ni tildes e ignora los puntos. Hasta ${Q_MAX} caracteres; se usan las primeras ${MAX_TERMINOS} palabras`,
    example: 'juan gonz',
  })
