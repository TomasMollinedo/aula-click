import type { VariantProps } from 'class-variance-authority'
import { format, parseISO } from 'date-fns'

import type { badgeVariants } from '@/components/ui/badge'
import type { UsuarioAuditoria } from '@/types'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { textoMes } from '@/utils/formato-fechas'

import type { FilaLiquidacion } from './liquidaciones.types'

type VarianteBadge = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** Lo que hace falta para mostrar el estado: sirve para la fila del listado y para el detalle. */
export type EstadoAMostrar = Pick<
  FilaLiquidacion,
  'estado' | 'fechaTransferencia' | 'descontadaEnMes'
>

export type FormatoEstado = { texto: string; variante: VarianteBadge }

/** `'2026-10-05'` → `'05/10/2026'`. */
export function fechaLarga(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy')
}

/**
 * El texto y la variante del badge de cada estado: "Pagada el 05/10/2026", "Descontada en la
 * liquidación de noviembre de 2026", etc. Si falta la fecha o el mes (no debería), queda el texto
 * sin ellos.
 */
export function formatoEstadoLiquidacion({
  estado,
  fechaTransferencia,
  descontadaEnMes,
}: EstadoAMostrar): FormatoEstado {
  switch (estado) {
    case 'EN_CURSO':
      return { texto: 'En curso', variante: 'outline' }
    case 'PENDIENTE_DE_PAGO':
      return { texto: 'Pendiente de pago', variante: 'pendiente' }
    case 'SALDO_A_DESCONTAR':
      return { texto: 'Saldo a descontar el mes próximo', variante: 'secondary' }
    case 'PAGADA':
      return {
        texto: fechaTransferencia ? `Pagada el ${fechaLarga(fechaTransferencia)}` : 'Pagada',
        variante: 'confirmado',
      }
    case 'DESCONTADA':
      return {
        texto: descontadaEnMes
          ? `Descontada en la liquidación de ${textoMes(descontadaEnMes)}`
          : 'Descontada',
        variante: 'outline',
      }
  }
}

/** "Gómez, Ana". */
export function nombreDeProfesor({ apellido, nombre }: { apellido: string; nombre: string }) {
  return `${apellido}, ${nombre}`
}

/** `'N.º 123'`: el número del comprobante del cobro de un turno. */
export function textoNumeroComprobante(numero: number): string {
  return `N.º ${numero}`
}

/**
 * `'Adjuntado por Marta Ríos · 05/10/2026, 11:03'`: quién subió el comprobante de la transferencia
 * y cuándo (el mismo texto que el comprobante adjunto de un pago, en `pagos`).
 */
export function textoAdjuntadoPor(usuario: UsuarioAuditoria, instante: string): string {
  return `Adjuntado por ${nombreUsuarioAuditoria(usuario)} · ${formatoInstante(instante)}`
}

/** `'Registrado por Marta Ríos · 05/10/2026, 14:03'`: quién registró el pago y cuándo. */
export function textoRegistradoPor(usuario: UsuarioAuditoria, instante: string): string {
  return `Registrado por ${nombreUsuarioAuditoria(usuario)} · ${formatoInstante(instante)}`
}
