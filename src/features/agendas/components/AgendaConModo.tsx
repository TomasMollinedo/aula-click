'use client'

import type { ReactNode } from 'react'

import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import type { FiltrosAgenda } from '@/types/agenda'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

import { DetalleAgendaProvider } from '../hooks/use-detalle-agenda'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useModoAgenda } from '../hooks/use-modo-agenda'
import { SelectorModoAgenda } from './SelectorModoAgenda'

type AgendaConModoProps = {
  /** Lo que se ve en el modo "Lista": la agenda de siempre. Solo se monta en ese modo. */
  children: ReactNode
  /** Lo que se ve en el modo "Calendario" (recibe los filtros de la URL). */
  renderCalendario: (filtros: FiltrosAgenda) => ReactNode
  /** Compone `app/` el detalle de un turno (`?detalle=&fecha=`): vale para los dos modos. */
  renderDetalle: RenderDetalleOcurrencia
  /** Junto al selector, por ejemplo el botón del PDF de la agenda diaria. */
  acciones?: ReactNode
}

/**
 * Lo que comparten las tres agendas (diaria, de un profesor y "Mi agenda"): el selector
 * "Calendario / Lista" cuyo modo va en la URL y por defecto es el calendario (HU-19), el detalle del
 * turno abierto desde la URL y el lugar para las acciones del encabezado. Los filtros de estado y
 * prioridad (HU-18) viven en la URL (`useFiltrosAgenda`) y valen en los dos modos: en la lista van
 * a la derecha de la navegación por fecha, dentro de su tarjeta (`AgendaDiariaListado`,
 * `AgendaPorRango`); en el calendario, en la cabecera de su tarjeta (`CalendarioSemanal`). La lista
 * y el calendario se montan de a uno, así el que no se ve no pide datos.
 */
export function AgendaConModo({
  children,
  renderCalendario,
  renderDetalle,
  acciones,
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
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {acciones}
            <SelectorModoAgenda value={modo} onChange={cambiarModo} />
          </div>
        </div>

        {modo === 'calendario' ? renderCalendario(filtros) : children}

        {detalle && renderDetalle({ ...detalle, onCerrar: cerrar })}
      </div>
    </DetalleAgendaProvider>
  )
}
