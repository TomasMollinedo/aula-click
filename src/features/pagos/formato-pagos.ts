import { formatearPesos } from '@/utils/moneda'

import type { ResumenACobrar } from './a-cobrar'
import type { PagoRegistrado } from './pagos.types'

// Textos del registro de un pago (HU-15). Los importes del éxito y del vuelto son los que devolvió
// la API, nunca los del resumen local.

/** `'1 turno'` / `'4 turnos'`. */
export function textoCantidad(cantidad: number): string {
  return cantidad === 1 ? '1 turno' : `${cantidad} turnos`
}

/**
 * `'¿Registrar el pago de 4 turnos por $ 32.000 en efectivo?'`. Sin total (alguna sin precio):
 * `'¿Registrar el pago de 4 turnos en efectivo?'`.
 */
export function textoConfirmacion(resumen: Pick<ResumenACobrar, 'cantidad' | 'total'>): string {
  const importe = resumen.total === null ? '' : ` por ${formatearPesos(resumen.total)}`
  return `¿Registrar el pago de ${textoCantidad(resumen.cantidad)}${importe} en efectivo?`
}

/** `'Pago registrado: 4 turnos por $ 32.000'`, con la cantidad y el total de la respuesta. */
export function textoExito(pago: Pick<PagoRegistrado, 'cantidad' | 'total'>): string {
  return `Pago registrado: ${textoCantidad(pago.cantidad)} por ${formatearPesos(pago.total)}`
}

/**
 * `'Vuelto: $ 3.000'`, o `null` si no se informó el monto recibido. Un vuelto de 0 se muestra
 * (`'Vuelto: $ 0'`): el monto se informó y era justo. Sirve para la respuesta y el comprobante.
 */
export function textoVuelto(pago: Pick<PagoRegistrado, 'vuelto'>): string | null {
  return pago.vuelto === null ? null : `Vuelto: ${formatearPesos(pago.vuelto)}`
}
