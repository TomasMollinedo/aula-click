import type { EstadoPagoRegistrado } from '@/types/pago'
import { formatearPesos } from '@/utils/moneda'
import { cn } from '@/utils/cn'

import { FORMAS_PAGO } from '../filtros-pagos-realizados'
import {
  muestraPorForma,
  textoFormaPago,
  textoPeriodo,
  textoQueSeCuenta,
  totalesAMostrar,
} from '../formato-pagos'
import type { TotalesPagosRealizados as Totales } from '../pagos-realizados.types'

/**
 * Los totales del filtro (HU-36), arriba de la tabla, tal como vienen de la API: nada se suma acá.
 * Son de **todo** el filtro (decisión T-151). Según el estado: con "Todos", lo cobrado y, al lado,
 * lo anulado en rojo; con "Vigentes", solo lo cobrado; con "Anulados", solo lo anulado. El detalle
 * por forma de pago es de lo cobrado: no va con "Anulados". Debajo, el período y qué se cuenta (con
 * materia o profesor, cada pago suma su total completo, decisión T-152). `enEspera`: son del filtro
 * anterior mientras llegan los nuevos (`isPlaceholderData`).
 */
export function TotalesPagosRealizados({
  totales,
  estado,
  periodo,
  porTurno,
  enEspera,
}: {
  totales: Totales
  /** El filtro de estado; `null` = "Todos". */
  estado: EstadoPagoRegistrado | null
  periodo: { desde: string; hasta: string }
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
      <div className="min-w-0 md:flex-1">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          {totalesAMostrar(totales, estado).map(({ etiqueta, importe, anulado }, i) => (
            <div key={etiqueta} className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                {etiqueta}
              </p>
              <p
                className={cn(
                  'mt-1 font-semibold tabular-nums',
                  // El primero es el total destacado; "Anulado" al lado del cobrado va más chico.
                  i === 0 ? 'text-3xl' : 'text-xl',
                  anulado && 'text-cancelado',
                )}
              >
                {formatearPesos(importe)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="text-foreground font-medium">{textoPeriodo(periodo)}</span>
          {' · '}
          {textoQueSeCuenta(estado, porTurno)}
        </p>
      </div>

      {muestraPorForma(estado) && (
        // No se achica: los importes no se cortan; la línea del período, a su izquierda, se ajusta.
        <dl className="grid shrink-0 grid-cols-3 gap-4 sm:gap-8">
          {FORMAS_PAGO.map((codigo) => (
            <div key={codigo} className="min-w-0">
              <dt className="text-muted-foreground text-xs">{textoFormaPago(codigo)}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatearPesos(totales.porForma[codigo])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
