'use client'

import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { hayFiltrosActivos, paramsDeCanceladosYPrioridad } from '../filtros-agenda'
import { useAgendaPropia } from '../hooks/use-agenda-propia'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useRangoAgendaEnUrl } from '../hooks/use-rango-agenda-en-url'
import { AgendaConModo } from './AgendaConModo'
import { AgendaPorRango } from './AgendaPorRango'
import { CalendarioSemanal } from './CalendarioSemanal'

function mensajeError(error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver esta agenda'
  if (error?.status === 404) {
    return 'Tu usuario no tiene una ficha de profesor: pedile a mesa de entradas que la revise'
  }
  return error?.message ?? 'Ocurrió un error inesperado'
}

type AgendaPropiaListadoProps = {
  /** Compone `app/` el detalle de un turno (`?detalle=&fecha=`). */
  renderDetalle: RenderDetalleOcurrencia
}

/**
 * Agenda propia del profesor (HU-10, T-26), como lista o como calendario semanal (HU-19). La vista
 * de la lista (`?vista=dia|semana`, por defecto día) y la fecha (`?fecha=`) van en la URL
 * (`useRangoAgendaEnUrl`), para que Atrás conserve lo que se estaba viendo.
 */
export function AgendaPropiaListado({ renderDetalle }: AgendaPropiaListadoProps) {
  return (
    <AgendaConModo
      enEncabezado="titulo"
      renderDetalle={renderDetalle}
      renderCalendario={(filtros) => (
        <CalendarioSemanal
          origen={{ tipo: 'propia' }}
          filtros={filtros}
          renderDetalle={renderDetalle}
        />
      )}
    >
      <ListaAgendaPropia />
    </AgendaConModo>
  )
}

// Sola en un componente para que sus pedidos solo se hagan en el modo "Lista".
function ListaAgendaPropia() {
  const { vista, fecha, rango, hoy, cambiar } = useRangoAgendaEnUrl({ vistaPorDefecto: 'dia' })
  const { filtros } = useFiltrosAgenda()
  const query = useAgendaPropia({ ...rango, ...paramsDeCanceladosYPrioridad(filtros) })

  return (
    <AgendaPorRango
      vista={vista}
      fecha={fecha}
      hoy={hoy}
      onCambiar={cambiar}
      query={query}
      mensajeError={mensajeError}
      hayFiltros={hayFiltrosActivos(filtros)}
    />
  )
}
