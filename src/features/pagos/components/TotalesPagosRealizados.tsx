import { formatearPesos } from '@/utils/moneda'
import { cn } from '@/utils/cn'

import { FORMAS_PAGO } from '../filtros-pagos-realizados'
import { textoFormaPago } from '../formato-pagos'
import type { TotalesPagosRealizados as Totales } from '../pagos-realizados.types'

/**
 * Lo cobrado del filtro (HU-36), arriba de la tabla: `cobrado` destacado y, al lado, las tres formas
 * de pago (también las que dan 0), tal como vienen de la API: nada se suma acá. Son de **todo** el
 * filtro y sin los pagos anulados (decisión T-151). Con materia o profesor, cada pago suma su total
 * completo (decisión T-152), y se aclara. `enEspera`: son del filtro anterior mientras llegan los
 * nuevos (`isPlaceholderData`).
 */
export function TotalesPagosRealizados({
  totales,
  porTurno,
  enEspera,
}: {
  totales: Totales
  /** Si hay filtro de materia o de profesor. */
  porTurno: boolean
  enEspera: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        enEspera && 'opacity-60',
      )}
      aria-busy={enEspera}
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Total cobrado
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatearPesos(totales.cobrado)}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Sin los pagos anulados.
          {porTurno && ' Con materia o profesor, suma el total completo de cada pago listado.'}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-4 sm:gap-8">
        {FORMAS_PAGO.map((codigo) => (
          <div key={codigo} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{textoFormaPago(codigo)}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {formatearPesos(totales.porForma[codigo])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
