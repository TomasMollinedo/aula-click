export type PageRangeItem = number | 'ellipsis'

/**
 * Páginas a mostrar en un paginador numerado: siempre la primera, la última, la actual y sus
 * vecinas; cerca de un extremo, las tres primeras (o últimas). Un hueco de una sola página se
 * completa con ese número y uno mayor se reemplaza por `'ellipsis'`.
 *
 * `getPageRange(1, 6)` → `[1, 2, 3, 'ellipsis', 6]`. Con `totalPages` 0 devuelve `[]`.
 */
export function getPageRange(currentPage: number, totalPages: number): PageRangeItem[] {
  if (totalPages <= 0) return []

  const current = Math.min(Math.max(currentPage, 1), totalPages)
  const pages = new Set([1, totalPages, current - 1, current, current + 1])
  if (current <= 3) [2, 3].forEach((p) => pages.add(p))
  if (current >= totalPages - 2) [totalPages - 1, totalPages - 2].forEach((p) => pages.add(p))

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const range: PageRangeItem[] = []
  for (const page of sorted) {
    const previous = range.at(-1)
    if (typeof previous === 'number' && page - previous === 2) range.push(previous + 1)
    else if (typeof previous === 'number' && page - previous > 2) range.push('ellipsis')
    range.push(page)
  }
  return range
}
