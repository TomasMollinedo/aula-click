import { format, parseISO } from 'date-fns'

import { fechaCorta, textoMes } from '@/utils/formato-fechas'
import { formatearPesos } from '@/utils/moneda'

import type { CodigoFormaPago, Movimiento, MotivoAnulacion, TipoMovimiento } from './caja.types'

// Los textos de la caja diaria (HU-46). Son los mismos que los del PDF que arma la API
// (`caja.formato.ts` del backend, que el frontend no puede importar). Funciones puras: ningún
// número se calcula acá, los importes son los que mandó la API.

/**
 * Las formas de pago del resumen, por su código (la API manda sólo el código). Es un `Record`
 * completo, así que una forma nueva en el contrato no compila hasta decidir cómo se escribe. En un
 * movimiento se muestra `formaPago.nombre`, el del catálogo.
 */
export const NOMBRE_FORMA_PAGO: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
}

/** Qué fue el movimiento, para la columna "Tipo" y el filtro. */
export const NOMBRE_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  COBRO: 'Cobro',
  ANULACION: 'Anulación',
  PAGO_PROFESOR: 'Pago a profesor',
}

const NOMBRE_MOTIVO: Record<MotivoAnulacion, string> = {
  ERROR_CARGA: 'Error de carga',
  FORMA_PAGO_EQUIVOCADA: 'Forma de pago equivocada',
  OTRO: 'Otro motivo',
}

/** El movimiento entra dinero: el cobro suma y los otros dos restan (lo decide el `tipo`). */
export function esIngreso(tipo: TipoMovimiento): boolean {
  return tipo === 'COBRO'
}

/** El signo del movimiento, con el signo menos (no el guion), según el `tipo`. */
export function signoDelTipo(tipo: TipoMovimiento): '+' | '−' {
  return esIngreso(tipo) ? '+' : '−'
}

/**
 * El importe con su signo: los cobros suman ("+ $ 8.000,00") y las anulaciones y los pagos a
 * profesores restan. El importe llega siempre positivo.
 */
export function textoImporteConSigno(movimiento: Pick<Movimiento, 'tipo' | 'importe'>): string {
  return `${signoDelTipo(movimiento.tipo)} ${formatearPesos(movimiento.importe)}`
}

/**
 * Cuándo se registró el movimiento, en la hora local: `'09:12'` si fue el día de la caja y
 * `'16/10 09:12'` si fue otro (un pago cargado con fecha de pago hacia atrás).
 */
export function textoHoraDeRegistro(registradoEl: string, fecha: string): string {
  const instante = parseISO(registradoEl)
  const hora = format(instante, 'HH:mm')
  return format(instante, 'yyyy-MM-dd') === fecha ? hora : `${format(instante, 'dd/MM')} ${hora}`
}

/** `'Gómez, Ana'`. */
export function apellidoYNombre({
  apellido,
  nombre,
}: {
  apellido: string
  nombre: string
}): string {
  return `${apellido}, ${nombre}`
}

/** `'Comprobante N° 1024'`. */
export function textoNumeroComprobante(numeroComprobante: number): string {
  return `Comprobante N° ${numeroComprobante}`
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

/** `'Operación 0048213'`, o `null` si la transferencia no tiene número cargado. */
export function textoOperacion(numeroOperacion: string | null): string | null {
  return numeroOperacion ? `Operación ${numeroOperacion}` : null
}

/** El mes liquidado de un pago a un profesor: `'2026-09'` → `'septiembre de 2026'`. */
export function textoMesLiquidado(mes: string): string {
  return textoMes(mes)
}

/** El aviso de un día sin movimientos: `'No hubo movimientos de caja el 15/10'`. */
export function textoSinMovimientos(fecha: string): string {
  return `No hubo movimientos de caja el ${fechaCorta(fecha)}`
}

/**
 * El aviso del día que **sí** tuvo movimientos, pero ninguno pasa los filtros de la lista: no es
 * un día sin caja, así que no se usa `textoSinMovimientos`.
 */
export function textoSinResultados(fecha: string): string {
  return `Ningún movimiento del ${fechaCorta(fecha)} coincide con los filtros`
}
