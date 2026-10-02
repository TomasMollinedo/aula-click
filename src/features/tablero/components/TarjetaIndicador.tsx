import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

import { TEXTO_NO_DISPONIBLE } from '../formato-tablero'

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
    <Card className={cn('gap-3 p-5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm leading-tight font-semibold">{titulo}</h3>
        <p className="text-muted-foreground mt-1 text-xs">{rotulo}</p>
      </div>
      {children}
    </Card>
  )
}

/** El número grande de una tarjeta, con una línea de apoyo (el porcentaje, "de 64 lugares"…). */
export function ValorIndicador({ valor, detalle }: { valor: string; detalle?: string | null }) {
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="text-muted-foreground mt-1 text-sm tabular-nums">{detalle}</p>}
    </div>
  )
}

/**
 * Un indicador que depende de la asistencia (`disponible: false`): sin número, ni un guion ni un
 * cero que se lea como dato.
 */
export function IndicadorNoDisponible() {
  return <p className="text-muted-foreground text-sm">{TEXTO_NO_DISPONIBLE}</p>
}
