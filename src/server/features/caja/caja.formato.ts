import { textoMes } from '@/server/features/liquidaciones/liquidaciones.condiciones'
import { fechaEnZona } from '@/server/shared/fechas'
import { fechaCorta, fechaHoraDocumento, formatearPesos } from '@/server/shared/formato'
import type { CodigoFormaPago, Movimiento, MotivoAnulacion } from './caja.reglas'

// Los textos de la caja diaria en PDF (HU-46, T-127). Devuelven lo mismo que los de la pantalla
// (`src/features/caja`): el backend no importa código del frontend, así que tiene los suyos.
// Funciones puras.

/** Las formas de pago del resumen, por su código (nunca por el nombre). */
export const NOMBRE_FORMA_DE_PAGO: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
}

const NOMBRE_MOTIVO: Record<MotivoAnulacion, string> = {
  ERROR_CARGA: 'Error de carga',
  FORMA_PAGO_EQUIVOCADA: 'Forma de pago equivocada',
  OTRO: 'Otro motivo',
}

/** `'Gómez, Ana'`. */
function apellidoYNombre({ apellido, nombre }: { apellido: string; nombre: string }): string {
  return `${apellido}, ${nombre}`
}

/**
 * Cuándo se registró un movimiento, en la hora del negocio: `'09:12'` si fue el día de la caja y
 * `'16/10 09:12'` si fue otro (un pago cargado con fecha de pago hacia atrás).
 */
export function textoHoraDeRegistro(registradoEl: string, fecha: string): string {
  const instante = new Date(registradoEl)
  // `fechaHoraDocumento` es `dd/MM/yyyy HH:mm`, en la hora del negocio.
  const [dia = '', hora = ''] = fechaHoraDocumento(instante).split(' ')
  return fechaEnZona(instante) === fecha ? hora : `${dia.slice(0, 5)} ${hora}`
}

/**
 * El importe con su signo: los cobros suman (`'+ $ 8.000,00'`) y las anulaciones y los pagos a
 * profesores restan (`'− $ 8.000,00'`, con el signo menos, no el guion).
 */
export function textoImporteConSigno(movimiento: Pick<Movimiento, 'tipo' | 'importe'>): string {
  return `${movimiento.tipo === 'COBRO' ? '+' : '−'} ${formatearPesos(movimiento.importe)}`
}

/**
 * Qué fue el movimiento, en un renglón:
 * - cobro: `'Cobro · Comprobante N° 1024 · Pérez, Juan'` (y `' · Anulado'` si se anuló después);
 * - anulación: `'Anulación · Comprobante N° 1024 · Pérez, Juan · Error de carga: se cargó dos veces'`;
 * - pago a un profesor: `'Pago a profesor · Gómez, Ana · septiembre de 2026 · Operación 0048213'`.
 */
export function textoMovimiento(movimiento: Movimiento): string {
  switch (movimiento.tipo) {
    case 'COBRO':
      return [
        'Cobro',
        `Comprobante N° ${movimiento.numeroComprobante}`,
        apellidoYNombre(movimiento.alumno),
        ...(movimiento.estado === 'ANULADO' ? ['Anulado'] : []),
      ].join(' · ')
    case 'ANULACION': {
      const motivo = NOMBRE_MOTIVO[movimiento.motivo]
      return [
        'Anulación',
        `Comprobante N° ${movimiento.numeroComprobante}`,
        apellidoYNombre(movimiento.alumno),
        movimiento.detalle ? `${motivo}: ${movimiento.detalle}` : motivo,
      ].join(' · ')
    }
    case 'PAGO_PROFESOR':
      return [
        'Pago a profesor',
        apellidoYNombre(movimiento.profesor),
        textoMes(movimiento.mes),
        ...(movimiento.numeroOperacion ? [`Operación ${movimiento.numeroOperacion}`] : []),
      ].join(' · ')
  }
}

/** El aviso de un día sin movimientos: `'No hubo movimientos de caja el 15/10'`. */
export function textoSinMovimientos(fecha: string): string {
  return `No hubo movimientos de caja el ${fechaCorta(fecha)}`
}

/** Nombre del archivo del PDF, sin extensión: `'caja-2026-10-15'`. */
export function nombreArchivoCaja(fecha: string): string {
  return `caja-${fecha}`
}
