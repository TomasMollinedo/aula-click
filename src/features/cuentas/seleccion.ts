import type { OcurrenciaACobrar } from '@/types/pago'
import { sumarImportes } from '@/utils/moneda'

import { aCobrar, claveOcurrencia, type FilaDeCuenta } from './a-cobrar'

// Selección de ocurrencias a cobrar (HU-16). Inmutable: cada función devuelve un `Map` nuevo, así
// sirve directo como estado de React. El valor es la copia de la fila (`aCobrar`) tomada al tildarla:
// si la fila desaparece (otro la cobró, o se cambió de página) la selección conserva lo que se vio.
//
// - En la ficha es una sola selección para adeudados y próximos (se pueden cobrar juntos). Se poda
//   contra las dos listas que se ven (`podar`), con datos reales: sale lo cobrado, lo cancelado y
//   también lo que un filtro saca de la vista (**filtrar es podar**: no se cobra lo que no se ve).
//   El diálogo la recibe en el orden en que se muestra (`ordenarComoSeMuestran`).
// - En la vista global (con alumno filtrado) es una sola para las dos tablas y vive entre las
//   páginas de cualquiera de ellas: **no se poda contra la página**, porque lo tildado en otra
//   página no está en la actual, y se ordena con `ordenarPorFecha`, el mismo orden de la API. Se
//   vacía cuando cambia cualquier filtro, y al cerrar el diálogo se usa `quitar` (ver su JSDoc).

/** Clave (`claveOcurrencia`) → la copia de la ocurrencia tildada. */
export type Seleccion = ReadonlyMap<string, OcurrenciaACobrar>

type Ocurrencia = { turnoId: number; fecha: string }

export const SELECCION_VACIA: Seleccion = new Map()

export function estaSeleccionada(sel: Seleccion, o: Ocurrencia): boolean {
  return sel.has(claveOcurrencia(o))
}

/** Tilda la fila si no estaba, o la destilda si estaba. */
export function alternar(sel: Seleccion, fila: FilaDeCuenta): Seleccion {
  const nueva = new Map(sel)
  const clave = claveOcurrencia(fila)
  if (nueva.has(clave)) nueva.delete(clave)
  else nueva.set(clave, aCobrar(fila))
  return nueva
}

/**
 * Suma las filas que falten y no saca las que ya estaban: "Seleccionar todos los adeudados"
 * conserva los próximos tildados.
 */
export function seleccionarTodos(sel: Seleccion, filas: readonly FilaDeCuenta[]): Seleccion {
  const nueva = new Map(sel)
  for (const fila of filas) {
    const clave = claveOcurrencia(fila)
    if (!nueva.has(clave)) nueva.set(clave, aCobrar(fila))
  }
  return nueva
}

/**
 * Saca de la selección solo esas ocurrencias; lo demás tildado queda. Devuelve la misma selección
 * si no había ninguna, para no provocar un render de más.
 *
 * Es el cierre del diálogo en la vista global, donde no se puede podar (solo está la página
 * actual de cada tabla): si los adeudados o los próximos se volvieron a pedir mientras el diálogo
 * estaba abierto (cambió el `dataUpdatedAt` de `useAdeudados` o de `useProximos`) o se están
 * volviendo a pedir al cerrarlo (`isFetching`), hubo un pago o un 409 y se sacan las ocurrencias
 * de **esa solicitud**; si no, se canceló y la selección no cambia. Así la acción de una fila no
 * borra lo demás tildado.
 *
 * Caso borde aceptado: con `staleTime` de 60 s y `refetchOnWindowFocus`, un refetch por foco
 * mientras el diálogo está abierto y después se cancela también saca esa solicitud de la
 * selección. Se vuelve a tildar.
 */
export function quitar(sel: Seleccion, ocurrencias: readonly Ocurrencia[]): Seleccion {
  const claves = ocurrencias.map(claveOcurrencia).filter((clave) => sel.has(clave))
  if (claves.length === 0) return sel
  const nueva = new Map(sel)
  for (const clave of claves) nueva.delete(clave)
  return nueva
}

/** "Quitar selección". */
export function quitarTodos(): Seleccion {
  return SELECCION_VACIA
}

/**
 * Deja solo lo que sigue en la lista que se ve: lo cobrado o cancelado desaparece de la cuenta, y
 * lo que un filtro saca de la vista también sale (si después se quita el filtro, no vuelve
 * tildado). Devuelve la misma selección si no cambió, para no provocar un render de más: la ficha
 * la guarda como estado durante el render.
 */
export function podar(sel: Seleccion, vigentes: readonly Ocurrencia[]): Seleccion {
  const claves = new Set(vigentes.map(claveOcurrencia))
  if ([...sel.keys()].every((clave) => claves.has(clave))) return sel
  return new Map([...sel].filter(([clave]) => claves.has(clave)))
}

/**
 * Lo tildado, en el orden en que se muestra (adeudados y después próximos, cada uno en el orden de
 * la API): así la posición de cada error del diálogo (`["ocurrencias", i]`) coincide con lo que ve
 * quien cobra. Lo tildado que no está en la lista queda afuera (en la ficha no pasa: se poda antes).
 */
export function ordenarComoSeMuestran(
  sel: Seleccion,
  listaMostrada: readonly Ocurrencia[],
): OcurrenciaACobrar[] {
  return listaMostrada.flatMap((o) => sel.get(claveOcurrencia(o)) ?? [])
}

/**
 * Lo tildado por fecha, hora de inicio y `turnoId`, el orden de la API. Es el de la vista global,
 * donde lo tildado puede estar en otras páginas. Las horas son `HH:mm`: se comparan como texto.
 */
export function ordenarPorFecha(sel: Seleccion): OcurrenciaACobrar[] {
  return [...sel.values()].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.horaInicio.localeCompare(b.horaInicio) ||
      a.turnoId - b.turnoId,
  )
}

export type ResumenSeleccion = {
  cantidad: number
  /** Suma de los importes de la API, o `null` si alguno no tiene precio. */
  total: number | null
  sinPrecio: number
}

/** Cantidad y total de lo tildado, con los importes que mandó la API (`sumarImportes`). */
export function resumenSeleccion(sel: Seleccion): ResumenSeleccion {
  return { cantidad: sel.size, ...sumarImportes([...sel.values()].map((o) => o.importe)) }
}
