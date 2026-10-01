import { formatearPesos } from '@/utils/moneda'
import { cn } from '@/utils/cn'

/** Un importe grande con su etiqueta ("Total adeudado", "Pagado este mes"), tal como lo manda la API. */
export function TotalDestacado({
  etiqueta,
  importe,
  className,
}: {
  etiqueta: string
  importe: number
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {etiqueta}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{formatearPesos(importe)}</p>
    </div>
  )
}
