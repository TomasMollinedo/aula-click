'use client'

import type { ApiError } from '@/utils/fetch-json'

import { useAgendaPropia } from '../hooks/use-agenda-propia'
import { useRangoAgendaEnUrl } from '../hooks/use-rango-agenda-en-url'
import { AgendaPorRango } from './AgendaPorRango'

function mensajeError(error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver esta agenda'
  if (error?.status === 404) {
    return 'Tu usuario no tiene una ficha de profesor: pedile a mesa de entradas que la revise'
  }
  return error?.message ?? 'Ocurrió un error inesperado'
}

/**
 * Agenda propia del profesor (HU-10, T-26), de sólo lectura: sin acciones que modifiquen un turno,
 * porque la API no las soporta en este incremento. La vista (`?vista=dia|semana`, por defecto día)
 * y la fecha (`?fecha=`) van en la URL (`useRangoAgendaEnUrl`), para que Atrás conserve lo que se
 * estaba viendo.
 */
export function AgendaPropiaListado() {
  const { vista, fecha, rango, hoy, cambiar } = useRangoAgendaEnUrl({ vistaPorDefecto: 'dia' })
  const query = useAgendaPropia(rango)

  return (
    <AgendaPorRango
      vista={vista}
      fecha={fecha}
      hoy={hoy}
      onCambiar={cambiar}
      query={query}
      mensajeError={mensajeError}
    />
  )
}
