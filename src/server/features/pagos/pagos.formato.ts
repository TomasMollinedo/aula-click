import { fechaHoraDocumento } from '@/server/shared/formato'
import type { Comprobante, RedDebito } from './pagos.validation'

// Textos del comprobante de pago en PDF (HU-15). Devuelven lo mismo que los del frontend
// (`src/features/pagos/formato-pagos.ts`), que el backend no puede importar.

/** `'N° 1024'`: el número solo, junto al título del comprobante. */
export function textoNumero(numeroComprobante: number): string {
  return `N° ${numeroComprobante}`
}

/**
 * Quién cargó el pago y cuándo, en el pie del comprobante: `'Registrado por Ana Pérez el
 * 05/10/2026 11:30'`. El instante es ISO 8601 (UTC) y se muestra en la hora del negocio.
 */
export function textoRegistradoPor(
  usuario: { nombre: string; apellido: string },
  instante: string,
): string {
  const cuando = fechaHoraDocumento(new Date(instante))
  return `Registrado por ${usuario.nombre} ${usuario.apellido} el ${cuando}`
}

/** La red de una tarjeta de débito para mostrar (HU-23). */
const NOMBRE_RED: Record<RedDebito, string> = {
  VISA_DEBITO: 'Visa Débito',
  MASTERCARD_DEBITO: 'Mastercard Débito',
  MAESTRO: 'Maestro',
  CABAL_DEBITO: 'Cabal Débito',
  OTRA: 'Otra',
}

export function textoRedDebito(red: RedDebito): string {
  return NOMBRE_RED[red]
}

/** Los últimos números de la tarjeta, con el resto oculto: `'**** 1234'`. */
export function textoTarjeta(ultimos4: string): string {
  return `**** ${ultimos4}`
}

/**
 * Los datos del medio de pago que muestra el comprobante, en orden (HU-23): de una transferencia,
 * la operación, el banco y el titular; de un débito, la red, el cupón y la tarjeta (`'**** 1234'`).
 * Un dato que no se cargó no va. El efectivo no tiene: su monto recibido y su vuelto van con el
 * total.
 */
export function datosDelMedio(
  comprobante: Pick<Comprobante, 'transferencia' | 'debito'>,
): { label: string; valor: string }[] {
  const { transferencia, debito } = comprobante
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
  return []
}

/** Nombre del archivo del PDF, sin extensión: `'comprobante-1024'` (solo el número). */
export function nombreArchivoComprobante(numeroComprobante: number): string {
  return `comprobante-${numeroComprobante}`
}
