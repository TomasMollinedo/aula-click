// Búsqueda en una lista que ya está en el cliente (un selector con buscador): la misma regla en
// toda la UI. La búsqueda contra la API la resuelve el backend (`q`, docs/contrato-api.md → Filtros).

/** Sin tildes ni mayúsculas, para que "nunez" encuentre a "Núñez". */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Si `texto` tiene todas las palabras de `busqueda`, en cualquier orden y en forma parcial, sin
 * tildes ni mayúsculas (`'cuant fis'` encuentra "Física Cuántica"). Una búsqueda vacía coincide
 * con todo.
 */
export function coincideConBusqueda(texto: string, busqueda: string): boolean {
  const normalizado = normalizarBusqueda(texto)
  return normalizarBusqueda(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((termino) => normalizado.includes(termino))
}
