import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { formatearPesos } from '@/utils/moneda'

import { CODIGOS_FORMA_PAGO, type ResumenCaja } from '../caja.types'
import { NOMBRE_FORMA_PAGO } from '../formato-caja'

/**
 * El resumen del día (HU-46): ingresos por forma de pago y total, de ese total la parte del centro
 * y la de los profesores, los egresos y el saldo. **Todo como lo manda la API**: acá no se suma ni
 * se recalcula nada, y `total` y `saldo` pueden ser negativos. Es siempre el del día completo: los
 * filtros de la lista no lo cambian, y se aclara.
 *
 * `enEspera`: es el del día anterior mientras llega el nuevo (`isPlaceholderData`).
 */
export function ResumenDelDia({ resumen, enEspera }: { resumen: ResumenCaja; enEspera: boolean }) {
  const { ingresos } = resumen

  return (
    <Card className={cn('gap-6', enEspera && 'opacity-60')} aria-busy={enEspera} aria-live="polite">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <dl className="min-w-0">
          <Importe
            label="Total de ingresos"
            valor={ingresos.total}
            destacado
            detalle="Cobros menos anulaciones del día."
          />
        </dl>
        <dl className="grid grid-cols-3 gap-4 sm:gap-8">
          {CODIGOS_FORMA_PAGO.map((codigo) => (
            <div key={codigo} className="min-w-0">
              <dt className="text-muted-foreground text-xs">{NOMBRE_FORMA_PAGO[codigo]}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatearPesos(ingresos.porForma[codigo])}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <dl className="border-border grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <Importe label="Parte del centro" valor={ingresos.parteCentro} />
        <Importe label="Parte de los profesores" valor={ingresos.parteProfesores} />
        <Importe label="Egresos (pagado a profesores)" valor={resumen.egresos} />
        <Importe label="Saldo del día" valor={resumen.saldo} resaltado />
      </dl>

      <p className="text-muted-foreground text-sm">
        Es el resumen del día completo: los filtros de la lista no lo cambian.
      </p>
    </Card>
  )
}

/** Un importe del resumen, con su rótulo. Los negativos van tal como vienen, con su signo. */
function Importe({
  label,
  valor,
  detalle,
  destacado = false,
  resaltado = false,
}: {
  label: string
  valor: number
  detalle?: string
  /** El total de ingresos, que es lo que más se mira: más grande. */
  destacado?: boolean
  /** El saldo del día: en negrita, para cerrar el resumen. */
  resaltado?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 tabular-nums',
          destacado ? 'text-3xl font-semibold' : 'text-lg',
          resaltado && 'font-semibold',
        )}
      >
        {formatearPesos(valor)}
        {detalle && (
          <span className="text-muted-foreground mt-1 block text-sm font-normal">{detalle}</span>
        )}
      </dd>
    </div>
  )
}
