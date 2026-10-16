import type { UsuarioAuditoria } from '@/types'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type { ResumenACobrar } from './a-cobrar'
import type {
  CodigoFormaPago,
  DetallePago,
  MotivoAnulacion,
  RedDebito,
} from './pago-detalle.types'

import type { PagoRegistrado } from './pagos.types'

// Textos del registro de un pago (HU-15). Los importes del éxito y del vuelto son los que devolvió
// la API, nunca los del resumen local.

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

/**
 * El subtotal de una materia en el resumen (HU-25): `'Inglés (2 turnos): $ 18.000,00'`, o
 * `'… sin calcular'` si alguno de sus turnos no tiene precio.
 */
export function textoSubtotal(subtotal: {
  materia: { nombre: string }
  cantidad: number
  total: number | null
}): string {
  const importe = subtotal.total === null ? 'sin calcular' : formatearPesos(subtotal.total)
  return `${subtotal.materia.nombre} (${textoCantidad(subtotal.cantidad)}): ${importe}`
}

/** `'Total: $ 32.000,00'`, o `'Total: sin calcular'` si alguno no tiene precio. */
export function textoTotal(total: number | null): string {
  return `Total: ${total === null ? 'sin calcular' : formatearPesos(total)}`
}

const NOMBRE_FORMA: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
}

/** El nombre de una forma de pago para elegirla: `'Tarjeta de débito'` (el del catálogo). */
export function textoFormaPago(formaPago: CodigoFormaPago): string {
  return NOMBRE_FORMA[formaPago]
}

const FRASE_MEDIO: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'en efectivo',
  TRANSFERENCIA: 'por transferencia',
  DEBITO: 'con débito',
}

/**
 * `'¿Registrar el pago de 4 turnos por $ 32.000,00 por transferencia?'`, con el medio elegido. Sin
 * total (alguna sin precio): `'¿Registrar el pago de 4 turnos en efectivo?'`.
 */
export function textoConfirmacion(
  resumen: Pick<ResumenACobrar, 'cantidad' | 'total'>,
  formaPago: CodigoFormaPago,
): string {
  const importe = resumen.total === null ? '' : ` por ${formatearPesos(resumen.total)}`
  return `¿Registrar el pago de ${textoCantidad(resumen.cantidad)}${importe} ${FRASE_MEDIO[formaPago]}?`
}

/**
 * `'Pago registrado: 4 turnos por $ 32.000,00 por transferencia'`, con la cantidad, el total y el
 * medio de la respuesta.
 */
export function textoExito(pago: Pick<PagoRegistrado, 'cantidad' | 'total' | 'formaPago'>): string {
  return `Pago registrado: ${textoCantidad(pago.cantidad)} por ${formatearPesos(pago.total)} ${FRASE_MEDIO[pago.formaPago]}`
}

/** `'N° 1024'`. */
export function textoNumero(numeroComprobante: number): string {
  return `N° ${numeroComprobante}`
}

/** `'Comprobante N° 1024'`. */
export function textoNumeroComprobante(numeroComprobante: number): string {
  return `Comprobante ${textoNumero(numeroComprobante)}`
}

/**
 * `'Vuelto: $ 3.000,00'`. Un vuelto de 0 se muestra (`'Vuelto: $ 0,00'`): el monto era justo.
 * `null` sin vuelto: solo un pago anterior a que el monto recibido fuera obligatorio.
 */
export function textoVuelto(pago: { vuelto: number | null }): string | null {
  return pago.vuelto === null ? null : `Vuelto: ${formatearPesos(pago.vuelto)}`
}

// --- Detalle de un pago (HU-36, HU-24 y HU-42, T-99). Los mismos textos que el comprobante de pago
// en PDF (`pagos.formato.ts` de la API, que el frontend no puede importar). ---

/** `'Comprobante de pago N° 1024'`: el título del detalle, como el del PDF. */
export function textoTituloComprobante(numeroComprobante: number): string {
  return `Comprobante de pago ${textoNumero(numeroComprobante)}`
}

const NOMBRE_MOTIVO: Record<MotivoAnulacion, string> = {
  ERROR_CARGA: 'Error de carga',
  FORMA_PAGO_EQUIVOCADA: 'Forma de pago equivocada',
  OTRO: 'Otro motivo',
}

/**
 * El motivo de la anulación, con el detalle si lo hay: `'Error de carga: se cargó dos veces'` o
 * `'Forma de pago equivocada'`.
 */
export function textoMotivoAnulacion({
  motivo,
  detalle,
}: {
  motivo: MotivoAnulacion
  detalle: string | null
}): string {
  return detalle ? `${NOMBRE_MOTIVO[motivo]}: ${detalle}` : NOMBRE_MOTIVO[motivo]
}

const NOMBRE_RED: Record<RedDebito, string> = {
  VISA_DEBITO: 'Visa Débito',
  MASTERCARD_DEBITO: 'Mastercard Débito',
  MAESTRO: 'Maestro',
  CABAL_DEBITO: 'Cabal Débito',
  OTRA: 'Otra',
}

/** La red de una tarjeta de débito para mostrar: `'Visa Débito'`. */
export function textoRedDebito(red: RedDebito): string {
  return NOMBRE_RED[red]
}

/** Los últimos números de la tarjeta, con el resto oculto: `'**** 1234'`. */
export function textoTarjeta(ultimos4: string): string {
  return `**** ${ultimos4}`
}

/** `'Anulado el 06/10/2026, 09:00 por Laura Gómez'`, en la hora local. */
export function textoAnuladoEl({
  anuladoPor,
  anuladoEl,
}: {
  anuladoPor: UsuarioAuditoria
  anuladoEl: string
}): string {
  return `Anulado el ${formatoInstante(anuladoEl)} por ${nombreUsuarioAuditoria(anuladoPor)}`
}

/** `'Registrado por Laura Gómez · 05/10/2026, 11:30'`: la trazabilidad del pago. */
export function textoRegistradoPor(usuario: UsuarioAuditoria, instante: string): string {
  return `Registrado por ${nombreUsuarioAuditoria(usuario)} · ${formatoInstante(instante)}`
}

/** `'Adjuntado por Laura Gómez · 05/10/2026, 11:28'`: quién subió el comprobante adjunto y cuándo. */
export function textoAdjuntadoPor(usuario: UsuarioAuditoria, instante: string): string {
  return `Adjuntado por ${nombreUsuarioAuditoria(usuario)} · ${formatoInstante(instante)}`
}

/**
 * Los datos de la forma de pago, en orden (HU-23): del efectivo, el monto recibido y el vuelto; de
 * una transferencia, la operación, el banco y el titular; de un débito, la red, el cupón y la
 * tarjeta (`'**** 1234'`). Lo que no vino no va. Los importes son los de la API.
 */
export function datosDelMedio(
  pago: Pick<DetallePago, 'montoRecibido' | 'vuelto' | 'transferencia' | 'debito'>,
): { label: string; valor: string }[] {
  const { transferencia, debito } = pago
  if (transferencia) {
    return [
      { label: 'Operación', valor: transferencia.operacion },
      { label: 'Banco', valor: transferencia.banco },
      ...(transferencia.titular ? [{ label: 'Titular', valor: transferencia.titular }] : []),
    ]
  }
  if (debito) {
    return [
      { label: 'Red', valor: textoRedDebito(debito.red) },
      { label: 'Cupón', valor: debito.cupon },
      ...(debito.ultimos4 ? [{ label: 'Tarjeta', valor: textoTarjeta(debito.ultimos4) }] : []),
    ]
  }
  return [
    ...(pago.montoRecibido !== null
      ? [{ label: 'Monto recibido', valor: formatearPesos(pago.montoRecibido) }]
      : []),
    ...(pago.vuelto !== null ? [{ label: 'Vuelto', valor: formatearPesos(pago.vuelto) }] : []),
  ]
}

// --- Pagos realizados (HU-36, T-100). ---

const NOMBRE_FORMA_PAGO: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
}

/**
 * El nombre de una forma de pago por su código, para el filtro y el detalle de los totales (que
 * vienen por código): `'Tarjeta de débito'`. Los mismos nombres que el catálogo de la API.
 */
export function textoFormaPago(codigo: CodigoFormaPago): string {
  return NOMBRE_FORMA_PAGO[codigo]
}
