'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FiltrosAgenda } from '@/types/agenda'

export type BotonPdfAgendaProps = {
  /** Día de la agenda (`YYYY-MM-DD`). */
  fecha: string
  filtros: FiltrosAgenda
}

/**
 * "Generar PDF" de la agenda diaria (HU-11, T-60), en su encabezado: abre la hoja de impresión en
 * una pestaña nueva, con la fecha y los filtros tal cual están en la URL, así la agenda que estaba
 * abierta queda intacta en la pestaña original (cancelar o cerrar el diálogo de imprimir del
 * navegador no se puede detectar: no hay forma de "volver sola"). No pide datos: la hoja (`app/
 * mesa/agenda/imprimir`) trae todas las filas del día con el hook de la agenda, no sólo la página
 * visible.
 *
 * Sólo se muestra con un profesor elegido en el filtro: la agenda de todo el centro en un día
 * puede tener demasiados turnos para una sola hoja (decisión explícita, no está en el ticket
 * original). El PDF de un turno puntual sigue disponible siempre desde su detalle. Sin profesor
 * elegido, un aviso explica por qué no está el botón (T-68): sin esto no había forma de saber que
 * la opción existe.
 */
export function BotonPdfAgenda({ fecha, filtros }: BotonPdfAgendaProps) {
  if (filtros.profesorId == null) {
    return (
      <p className="text-muted-foreground text-sm">
        Filtrá por profesor para generar el PDF de su agenda
      </p>
    )
  }

  const searchParams = new URLSearchParams({ fecha, profesorId: String(filtros.profesorId) })
  if (filtros.incluirCancelados) searchParams.set('incluirCancelados', 'true')
  if (filtros.prioridad) searchParams.set('prioridad', filtros.prioridad)

  return (
    <Button type="button" variant="accent" asChild>
      <a href={`/mesa/agenda/imprimir?${searchParams}`} target="_blank" rel="noopener noreferrer">
        <Printer />
        Generar PDF
      </a>
    </Button>
  )
}
