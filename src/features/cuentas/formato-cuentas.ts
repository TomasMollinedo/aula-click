import { format, parseISO } from 'date-fns'

import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type { FilaDeCuenta } from './a-cobrar'
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

/** El importe de una fila: `'$ 8.000,00'`, o `'Sin precio'` si la materia no tiene. */
export function textoImporte(importe: number | null): string {
  return importe === null ? 'Sin precio' : formatearPesos(importe)
}

/** Fecha de pago del historial: `'2026-10-01'` → `'01/10/2026'`. */
export function textoFechaPago(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy')
}

/**
 * La ocurrencia en palabras, para los `aria-label` de la casilla y de la acción de cada fila:
 * `'lunes 05/10 de 9:00 a 10:00, Matemática'`. Con `conAlumno` (vista global sin filtro, donde las
 * filas son de varios alumnos) suma el alumno: `'Lucía Álvarez, lunes 05/10 de 9:00 a 10:00, …'`.
 */
export function textoOcurrencia(fila: FilaDeCuenta, conAlumno = false): string {
  const turno = `${fechaConDia(fila.fecha)} de ${rangoHoras(fila.horaInicio, fila.horaFin)}, ${fila.materia.nombre}`
  if (!conAlumno || !('alumno' in fila)) return turno
  return `${fila.alumno.nombre} ${fila.alumno.apellido}, ${turno}`
}
