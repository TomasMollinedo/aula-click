import { normalizarIds } from './filtros-cuenta'
import { textoMaterias } from './formato-cuentas'
import type { MateriaDeCuenta } from './hooks/use-materias-de-cuenta'

// El filtro de varias materias de `cuentas` (HU-25): qué opciones muestra, cuáles quedan con lo
// escrito en el buscador, qué dice el botón y cómo se tilda o destilda una. Funciones puras: el
// componente (`FiltroMaterias`) solo las muestra.

/** Una opción del filtro. `nombre: null` = una elegida cuyo nombre todavía no llegó. */
export type OpcionMateria = { id: number; nombre: string | null; inactiva: boolean }

/**
 * Las opciones: primero las elegidas que no están en la lista (no existen, o no entraron en la
 * página de materias), para que el control diga qué se está filtrando; después la lista.
 */
export function opcionesDeMaterias(
  lista: readonly MateriaDeCuenta[],
  elegidas: readonly { id: number; nombre: string | null }[],
): OpcionMateria[] {
  const enLista = new Set(lista.map((m) => m.id))
  const fueraDeLista = elegidas
    .filter((m) => !enLista.has(m.id))
    .map((m) => ({ id: m.id, nombre: m.nombre, inactiva: false }))
  return [...fueraDeLista, ...lista]
}

/** Sin tildes ni mayúsculas, para que "ingles" encuentre "Inglés". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Las opciones cuyo nombre tiene todas las palabras escritas, en cualquier orden. */
export function filtrarMaterias(
  opciones: readonly OpcionMateria[],
  texto: string,
): OpcionMateria[] {
  const terminos = normalizar(texto).split(/\s+/).filter(Boolean)
  if (terminos.length === 0) return [...opciones]
  return opciones.filter((opcion) => {
    const nombre = normalizar(opcion.nombre ?? '')
    return terminos.every((termino) => nombre.includes(termino))
  })
}

/** Tilda la materia si no estaba, o la destilda; el resultado queda normalizado. */
export function alternarMateria(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((otro) => otro !== id) : normalizarIds([...ids, id])
}

/**
 * Lo que dice el botón: `'Todas'` sin ninguna; con una o dos, sus nombres (`'Inglés y
 * Matemática'`); con más, la cantidad (`'3 materias'`). `'…'` mientras falta algún nombre.
 */
export function textoBotonMaterias(elegidas: readonly { nombre: string | null }[]): string {
  if (elegidas.length === 0) return 'Todas'
  if (elegidas.length > 2) return `${elegidas.length} materias`
  if (elegidas.some((m) => m.nombre === null)) return '…'
  return textoMaterias(elegidas.map((m) => m.nombre ?? '')) ?? 'Todas'
}
