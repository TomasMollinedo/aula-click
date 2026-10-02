import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

/**
 * Una tarjeta del tablero: qué se mide, a qué período (o fecha) corresponde y su contenido. Sin
 * enlaces: el tablero es de solo lectura (HU-21).
 */
export function TarjetaIndicador({
  titulo,
  rotulo,
  className,
  children,
}: {
  titulo: string
  /** El período al que corresponde el número ("Período: 28/09 al 04/10/2026"), o la fecha. */
  rotulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-4 p-5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm leading-tight font-semibold">{titulo}</h3>
        <p className="text-muted-foreground mt-1 text-xs">{rotulo}</p>
      </div>
      {children}
    </Card>
  )
}

/**
 * El número de una tarjeta, con una línea de apoyo. `destacado` es para el dinero, que es lo que
 * más se mira del tablero: más grande.
 */
export function ValorIndicador({
  valor,
  detalle,
  destacado = false,
}: {
  valor: string
  detalle?: string | null
  destacado?: boolean
}) {
  return (
    <div>
      <p
        className={cn(
          'font-semibold tabular-nums',
          destacado ? 'text-4xl tracking-tight' : 'text-3xl',
        )}
      >
        {valor}
      </p>
      {detalle && <p className="text-muted-foreground mt-1 text-sm tabular-nums">{detalle}</p>}
    </div>
  )
}
