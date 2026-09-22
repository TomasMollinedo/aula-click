// Diacríticos combinantes (tildes, diéresis, virgulilla de la ñ) que quedan sueltos tras NFD.
// Rango explícito en lugar de \p{M}: el tsconfig apunta a ES2017.
const DIACRITICOS = /[\u0300-\u036f]/g

/**
 * Texto de búsqueda sin mayúsculas ni tildes, con los espacios colapsados.
 * Se usa al guardar la columna `busqueda` y al normalizar el `q` de los listados.
 */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
