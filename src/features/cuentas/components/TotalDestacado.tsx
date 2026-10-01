import { formatearPesos } from '@/utils/moneda'
import { cn } from '@/utils/cn'

/**
 * Un importe grande con su etiqueta ("Total adeudado", "Total adeudado del período"), tal como lo
 * manda la API. `detalle` son los filtros activos (`textoFiltrosActivos`): el total los respeta
 * todos, y nombrarlos evita que se lea como el total general.
 */
export function TotalDestacado({
  etiqueta,
  importe,
  detalle,
  className,
}: {
  etiqueta: string
  importe: number
  detalle?: string | null
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)} aria-live="polite">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {etiqueta}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{formatearPesos(importe)}</p>
      {detalle && <p className="text-muted-foreground mt-1 text-sm">{detalle}</p>}
    </div>
  )
}
