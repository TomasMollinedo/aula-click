import { formatearPesos } from '@/utils/moneda'

import type {
  AvisoDeuda,
  AvisoPrecio,
  AvisoTransferenciaCompartida,
  PreviaAnulacion,
} from './anulaciones.types'

// Presentación de la anulación: la pregunta de confirmación, los avisos y el mensaje de éxito, como
// los pide la HU. Sin reglas: qué avisos corresponden y con qué números lo calcula la API; acá solo
// se arma el texto.

const turnos = (cantidad: number) => (cantidad === 1 ? '1 turno' : `${cantidad} turnos`)

/** `'¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000,00 (4 turnos)?'`. */
export function preguntaAnular({ pago }: Pick<PreviaAnulacion, 'pago'>): string {
  const { numeroComprobante, alumno, total, cantidad } = pago
  return `¿Anular el comprobante N.º ${numeroComprobante} de ${alumno.nombre} ${alumno.apellido} por ${formatearPesos(total)} (${turnos(cantidad)})?`
}

/**
 * `'Juan Pérez quedaría con deuda vencida: 5 turnos por $ 40.000,00 (4 de este pago)'`. Con 0 turnos
 * de este pago (ya tenía deuda vencida) no se aclara.
 */
export function avisoDeuda(deuda: AvisoDeuda, alumno: { nombre: string; apellido: string }) {
  const delPago = deuda.turnosDelPago > 0 ? ` (${turnos(deuda.turnosDelPago)} de este pago)` : ''
  return `${alumno.nombre} ${alumno.apellido} quedaría con deuda vencida: ${turnos(deuda.cantidad)} por ${formatearPesos(deuda.total)}${delPago}`
}

/**
 * `'Los turnos de Matemática se volverán a cobrar a $ 9.000,00 por hora; en este pago se cobraron a
 * $ 8.000,00'`. Si la materia ya no tiene precio, no se podrán volver a cobrar.
 */
export function avisoPrecio({ materia, cobrado, vigente }: AvisoPrecio): string {
  if (vigente === null) {
    return `${materia.nombre} ya no tiene precio: sus turnos no se podrán volver a cobrar hasta que se le ponga uno; en este pago se cobraron a ${formatearPesos(cobrado)} por hora`
  }
  return `Los turnos de ${materia.nombre} se volverán a cobrar a ${formatearPesos(vigente)} por hora; en este pago se cobraron a ${formatearPesos(cobrado)}`
}

/** `'Comprobante N.º 124 (Lucía Álvarez)'`. */
export function lineaPagoCompartido({
  numeroComprobante,
  alumno,
}: AvisoTransferenciaCompartida['pagos'][number]): string {
  return `Comprobante N.º ${numeroComprobante} (${alumno.nombre} ${alumno.apellido})`
}

/** El encabezado del aviso de la transferencia que cubre más de un pago. */
export function avisoTransferencia({
  operacion,
  banco,
  pagos,
}: AvisoTransferenciaCompartida): string {
  const otros =
    pagos.length === 1 ? 'Hay otro pago vigente' : `Hay otros ${pagos.length} pagos vigentes`
  return `${otros} con la misma transferencia (operación ${operacion}, ${banco}). No se anulan con éste:`
}

/** Mensaje del toast cuando la API confirma. */
export const MENSAJE_ANULADO = 'Pago anulado. Sus turnos volvieron a quedar pendientes de pago'
