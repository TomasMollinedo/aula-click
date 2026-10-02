'use client'

import type { ReactNode } from 'react'

import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import type { FiltrosAgenda } from '@/types/agenda'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'

import { DetalleAgendaProvider } from '../hooks/use-detalle-agenda'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useModoAgenda } from '../hooks/use-modo-agenda'
import { SelectorModoAgenda } from './SelectorModoAgenda'

type AgendaConModoProps = {
  /** Lo que se ve en el modo "Lista": la agenda de siempre. Solo se monta en ese modo. */
  children: ReactNode
  /** Lo que se ve en el modo "Calendario" (recibe los filtros de la URL). */
  renderCalendario: (filtros: FiltrosAgenda) => ReactNode
  /**
   * Compone `app/` el detalle de un turno (`?detalle=&fecha=`): vale para los dos modos. Sin él, la
   * agenda solo arma los links al detalle y lo monta quien la contiene (la ficha del alumno, que
   * tiene un solo detalle para todas sus pestañas).
   */
  renderDetalle?: RenderDetalleOcurrencia
  /** Junto al selector, por ejemplo el botón del PDF de la agenda diaria. */
  acciones?: ReactNode
  /**
   * Sube el selector y las acciones al borde derecho de un encabezado que está arriba: `'titulo'`,
   * a la línea del `PageHeader` (desde `sm`); `'pestanas'`, a la de las pestañas de la ficha
   * (desde `lg`, donde entran junto a ellas). En los dos casos el contenedor de esa pantalla tiene
   * que ser `relative` y el encabezado, su primer elemento.
   */
  enEncabezado?: 'titulo' | 'pestanas'
}

/**
 * Lo que comparten las agendas (diaria, de un profesor, "Mi agenda" y los turnos de un alumno): el selector
 * "Calendario / Lista" cuyo modo va en la URL y por defecto es el calendario (HU-19), el detalle del
 * turno abierto desde la URL y el lugar para las acciones del encabezado. Los filtros de estado y
 * prioridad (HU-18) viven en la URL (`useFiltrosAgenda`) y valen en los dos modos: en los dos van
 * en la cabecera de su tarjeta, debajo de la navegación por fecha (`BarraFiltrosAgenda` en
 * `AgendaDiariaListado` y `AgendaPorRango`; `CalendarioSemanal`, con los propios del calendario). La lista
 * y el calendario se montan de a uno, así el que no se ve no pide datos.
 */
export function AgendaConModo({
  children,
  renderCalendario,
  renderDetalle,
  acciones,
  enEncabezado,
}: AgendaConModoProps) {
  const { modo, cambiarModo } = useModoAgenda()
  const { filtros } = useFiltrosAgenda()
  // En una agenda `?fecha=` es también el día o la semana que se está viendo: al cerrar el detalle
  // se conserva.
  const { detalle, hrefDetalle, marcarAbiertoConLink, cerrar } = useDetalleEnUrl({
    fechaEsDeLaPantalla: true,
  })

  return (
    <DetalleAgendaProvider value={{ hrefDetalle, marcarAbiertoConLink }}>
      <div className="space-y-4">
        <div
          className={cn(
            'flex flex-wrap items-center justify-end gap-3',
            enEncabezado === 'titulo' && 'sm:absolute sm:top-0 sm:right-0',
            enEncabezado === 'pestanas' && 'lg:absolute lg:top-0 lg:right-0',
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {acciones}
            <SelectorModoAgenda value={modo} onChange={cambiarModo} />
          </div>
        </div>

        {modo === 'calendario' ? renderCalendario(filtros) : children}

        {detalle && renderDetalle?.({ ...detalle, onCerrar: cerrar })}
      </div>
    </DetalleAgendaProvider>
  )
}
