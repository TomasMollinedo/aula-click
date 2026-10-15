// Página de los exámenes pasados de la pestaña "Exámenes", en la URL (`?pagePasados=`). Único lugar
// que conoce el parámetro. La API devuelve todos los exámenes del alumno (sin paginar, T-55): se
// paginan en la pantalla, porque un alumno tiene pocos.

export const PARAMETRO_PAGINA_PASADOS = 'pagePasados'

/** Exámenes pasados por página. */
export const PASADOS_POR_PAGINA = 10

/** La página de la URL: un entero >= 1; cualquier otra cosa es la 1. */
export function leerPaginaPasados(params: URLSearchParams): number {
  const valor = Number(params.get(PARAMETRO_PAGINA_PASADOS))
  return Number.isInteger(valor) && valor >= 1 ? valor : 1
}

/** Los parámetros con la página; la 1 no se escribe. Los demás (el `tab`) se conservan. */
export function paramsConPaginaPasados(params: URLSearchParams, page: number): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (page > 1) nuevos.set(PARAMETRO_PAGINA_PASADOS, String(page))
  else nuevos.delete(PARAMETRO_PAGINA_PASADOS)
  return nuevos
}

/**
 * Los ítems de la página pedida y el total de páginas. Una página fuera de rango (por ejemplo,
 * después de eliminar un examen) cae en la última.
 */
export function paginar<T>(
  items: readonly T[],
  page: number,
  porPagina = PASADOS_POR_PAGINA,
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / porPagina))
  const actual = Math.min(Math.max(1, page), totalPages)
  const desde = (actual - 1) * porPagina
  return { items: items.slice(desde, desde + porPagina), page: actual, totalPages }
}

/** "Mostrando 1–10 de 28 exámenes", como el pie de los otros listados paginados. */
export function textoMostrando(
  page: number,
  total: number,
  porPagina = PASADOS_POR_PAGINA,
): string {
  const desde = (page - 1) * porPagina + 1
  const hasta = Math.min(page * porPagina, total)
  return `Mostrando ${desde}–${hasta} de ${total} ${total === 1 ? 'examen' : 'exámenes'}`
}
