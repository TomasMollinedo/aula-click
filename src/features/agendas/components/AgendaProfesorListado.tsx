'use client'

import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { hayFiltrosActivos, paramsDeEstadoYPrioridad } from '../filtros-agenda'
import { useAgendaProfesor } from '../hooks/use-agenda-profesor'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useRangoAgendaEnUrl } from '../hooks/use-rango-agenda-en-url'
import { AgendaConModo } from './AgendaConModo'
import { AgendaPorRango } from './AgendaPorRango'
import { CalendarioSemanal } from './CalendarioSemanal'

function mensajeError(error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver esta agenda'
  if (error?.status === 404) return 'Profesor no encontrado'
  return error?.message ?? 'Ocurrió un error inesperado'
}

const TEXTOS_VACIO = {
  dia: { title: 'Sin turnos este día', description: 'Elegí otro día para ver su agenda.' },
  semana: { title: 'Sin turnos esta semana', description: 'Elegí otra semana para ver su agenda.' },
}

type AgendaProfesorListadoProps = {
  profesorId: number
  /** Compone `app/` el detalle de un turno (`?detalle=&fecha=`). */
  renderDetalle: RenderDetalleOcurrencia
}

/**
 * Agenda de un profesor en su ficha (HU-02), como lista o como calendario semanal (HU-19), de solo
 * lectura y también para un profesor inactivo: la misma vista que "Mi agenda", con
 * `GET /agendas/profesor` y la semana como vista por defecto. La vista y la fecha van en la URL
 * junto con `?tab=agenda` (`useRangoAgendaEnUrl`). La compone `app/` en el tab "Agenda" de
 * `ProfesorDetalle` (prop `renderAgenda`), porque `features/profesores` no puede importar
 * componentes de `features/agendas`.
 */
export function AgendaProfesorListado({ profesorId, renderDetalle }: AgendaProfesorListadoProps) {
  return (
    <AgendaConModo
      enEncabezado="pestanas"
      renderDetalle={renderDetalle}
      renderCalendario={(filtros) => (
        <CalendarioSemanal
          origen={{ tipo: 'profesor', profesorId }}
          filtros={filtros}
          renderDetalle={renderDetalle}
        />
      )}
    >
      <ListaAgendaProfesor profesorId={profesorId} />
    </AgendaConModo>
  )
}

// Sola en un componente para que sus pedidos solo se hagan en el modo "Lista".
function ListaAgendaProfesor({ profesorId }: { profesorId: number }) {
  const { vista, fecha, rango, hoy, cambiar } = useRangoAgendaEnUrl({ vistaPorDefecto: 'semana' })
  const { filtros } = useFiltrosAgenda()
  const query = useAgendaProfesor({ profesorId, ...rango, ...paramsDeEstadoYPrioridad(filtros) })

  return (
    <AgendaPorRango
      vista={vista}
      fecha={fecha}
      hoy={hoy}
      onCambiar={cambiar}
      query={query}
      mensajeError={mensajeError}
      textosVacio={TEXTOS_VACIO}
      mostrarPago
      hayFiltros={hayFiltrosActivos(filtros)}
    />
  )
}
