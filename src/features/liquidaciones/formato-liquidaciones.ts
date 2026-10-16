import type { VariantProps } from 'class-variance-authority'
import { format, parseISO } from 'date-fns'

import type { badgeVariants } from '@/components/ui/badge'
import { textoMes } from '@/utils/formato-fechas'

import type { FilaLiquidacion } from './liquidaciones.types'

type VarianteBadge = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** Lo que hace falta para mostrar el estado: sirve para la fila del listado y para el detalle. */
export type EstadoAMostrar = Pick<
  FilaLiquidacion,
  'estado' | 'fechaTransferencia' | 'descontadaEnMes'
>

export type FormatoEstado = { texto: string; variante: VarianteBadge }

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
        texto: fechaTransferencia
          ? `Pagada el ${format(parseISO(fechaTransferencia), 'dd/MM/yyyy')}`
          : 'Pagada',
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
