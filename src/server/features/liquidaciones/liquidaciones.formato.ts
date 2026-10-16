import { fechaDocumento } from '@/server/shared/formato'
import { textoMes, type EstadoLiquidacion } from './liquidaciones.condiciones'
import type { LiquidacionDocumento } from './liquidaciones.documentos'

// Los textos del documento PDF de una liquidación (T-125). Devuelven lo mismo que la pantalla
// (`src/features/liquidaciones/formato-liquidaciones.ts`): el backend no importa código del
// frontend, así que tiene los suyos. Funciones puras.

const PORCENTAJE = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** `15` → `'15 %'`; `15.5` → `'15,5 %'` (con un espacio duro antes del `%`, como la pantalla). */
export function textoPorcentaje(porcentaje: number): string {
  return `${PORCENTAJE.format(porcentaje)} %`
}

/** `'N.º 123'`, el número del comprobante del cobro. */
export function textoNumeroComprobante(numero: number): string {
  return `N.º ${numero}`
}

/** `'Gómez, Ana'`. */
export function nombreDelProfesor({ apellido, nombre }: { apellido: string; nombre: string }) {
  return `${apellido}, ${nombre}`
}

const ESTADO: Record<EstadoLiquidacion, string> = {
  EN_CURSO: 'En curso',
  PENDIENTE_DE_PAGO: 'Pendiente de pago',
  SALDO_A_DESCONTAR: 'Saldo a descontar el mes próximo',
  PAGADA: 'Pagada',
  DESCONTADA: 'Descontada',
}

/**
 * El estado como en el badge de la pantalla: "Pagada el 05/10/2026", "Descontada en la liquidación
 * de noviembre de 2026", "Pendiente de pago"… Sin movimientos: "Sin movimientos".
 */
export function textoEstadoLiquidacion(
  documento: Pick<LiquidacionDocumento, 'estado' | 'transferencia' | 'descontadaEnMes'>,
): string {
  const { estado, transferencia, descontadaEnMes } = documento
  if (estado === null) return 'Sin movimientos'
  if (estado === 'PAGADA' && transferencia) {
    return `Pagada el ${fechaDocumento(transferencia.fecha)}`
  }
  if (estado === 'DESCONTADA' && descontadaEnMes) {
    return `Descontada en la liquidación de ${textoMes(descontadaEnMes)}`
  }
  return ESTADO[estado]
}

/** `'2026-09'` → `'Septiembre de 2026'`, con mayúscula (el título del mes en el documento). */
export function textoMesDelDocumento(mes: string): string {
  const texto = textoMes(mes)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
