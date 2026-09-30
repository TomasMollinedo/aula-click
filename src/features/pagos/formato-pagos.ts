import { format, parseISO } from 'date-fns'

import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type { ResumenACobrar } from './a-cobrar'
import type { PagoRegistrado } from './pagos.types'

// Textos del registro de un pago y del comprobante (HU-15). Los importes del éxito, del vuelto y del
// comprobante son los que devolvió la API, nunca los del resumen local.

/** `'1 turno'` / `'4 turnos'`. */
export function textoCantidad(cantidad: number): string {
  return cantidad === 1 ? '1 turno' : `${cantidad} turnos`
}

/** `'de 9:00 a 10:00'`. */
export function textoHorario(horaInicio: string, horaFin: string): string {
  return `de ${rangoHoras(horaInicio, horaFin)}`
}

/** El importe de un turno a cobrar: `'$ 8.000,00'`, o `'Sin precio'` si la materia no tiene. */
export function textoImporte(importe: number | null): string {
  return importe === null ? 'Sin precio' : formatearPesos(importe)
}

/** `'Total: $ 32.000,00'`, o `'Total: sin calcular'` si alguno no tiene precio. */
export function textoTotal(total: number | null): string {
  return `Total: ${total === null ? 'sin calcular' : formatearPesos(total)}`
}

/**
 * `'¿Registrar el pago de 4 turnos por $ 32.000,00 en efectivo?'`. Sin total (alguna sin precio):
 * `'¿Registrar el pago de 4 turnos en efectivo?'`.
 */
export function textoConfirmacion(resumen: Pick<ResumenACobrar, 'cantidad' | 'total'>): string {
  const importe = resumen.total === null ? '' : ` por ${formatearPesos(resumen.total)}`
  return `¿Registrar el pago de ${textoCantidad(resumen.cantidad)}${importe} en efectivo?`
}

/** `'Pago registrado: 4 turnos por $ 32.000,00'`, con la cantidad y el total de la respuesta. */
export function textoExito(pago: Pick<PagoRegistrado, 'cantidad' | 'total'>): string {
  return `Pago registrado: ${textoCantidad(pago.cantidad)} por ${formatearPesos(pago.total)}`
}

/** `'Comprobante N° 1024'`. */
export function textoNumeroComprobante(numeroComprobante: number): string {
  return `Comprobante N° ${numeroComprobante}`
}

/**
 * `'Vuelto: $ 3.000,00'`, o `null` si no se informó el monto recibido. Un vuelto de 0 se muestra
 * (`'Vuelto: $ 0,00'`): el monto se informó y era justo. Sirve para la respuesta y el comprobante.
 */
export function textoVuelto(pago: Pick<PagoRegistrado, 'vuelto'>): string | null {
  return pago.vuelto === null ? null : `Vuelto: ${formatearPesos(pago.vuelto)}`
}

/** Fecha de calendario en un documento: `'2026-10-05'` → `'05/10/2026'`. */
export function fechaDocumento(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy')
}

/** Instante ISO 8601 (UTC) en hora local del navegador: `'Registrado el 05/10/2026 11:30'`. */
export function textoRegistradoEl(instante: string): string {
  return `Registrado el ${format(parseISO(instante), 'dd/MM/yyyy HH:mm')}`
}
