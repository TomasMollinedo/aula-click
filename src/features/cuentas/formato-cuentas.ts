import { formatearPesos } from '@/utils/moneda'

import type { ResumenSeleccion } from './seleccion'

// Textos de la pestaña "Pagos" y de la vista global (HU-16). Los importes son los de la API.

/** `'1 turno'` / `'4 turnos'` (historial de pagos). */
export function textoCantidadTurnos(cantidad: number): string {
  return cantidad === 1 ? '1 turno' : `${cantidad} turnos`
}

/**
 * `'1 turno seleccionado · $ 8.000,00'` / `'4 turnos seleccionados · $ 32.000,00'`. Si alguno no
 * tiene precio: `'3 turnos seleccionados · total sin calcular'`.
 */
export function textoSeleccion({
  cantidad,
  total,
}: Pick<ResumenSeleccion, 'cantidad' | 'total'>): string {
  const turnos = cantidad === 1 ? '1 turno seleccionado' : `${cantidad} turnos seleccionados`
  return `${turnos} · ${total === null ? 'total sin calcular' : formatearPesos(total)}`
}
