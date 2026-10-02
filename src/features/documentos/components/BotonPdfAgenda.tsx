'use client'

import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FiltrosAgenda } from '@/types/agenda'

import { hrefPdfAgenda } from '../rutas-documentos'

export type BotonPdfAgendaProps = {
  /** Día de la agenda (`YYYY-MM-DD`). */
  fecha: string
  filtros: FiltrosAgenda
}

/**
 * "Generar PDF" de la agenda diaria (HU-11, T-60), en su encabezado: abre el PDF que arma la API
 * (`hrefPdfAgenda`) en una pestaña nueva, en el visor del navegador, con la fecha y los filtros tal
 * cual están en la URL, así la agenda que estaba abierta queda intacta en la pestaña original. No
 * pide datos: el documento trae todas las filas del día, no sólo la página visible.
 *
 * Sólo se muestra con un profesor elegido en el filtro: la agenda de todo el centro en un día
 * puede tener demasiados turnos para un solo documento (decisión explícita, no está en el ticket
 * original; la API exige `profesorId`). El PDF de un turno puntual sigue disponible siempre desde
 * su detalle. Sin profesor elegido, un aviso explica por qué no está el botón (T-68): sin esto no
 * había forma de saber que la opción existe.
 */
export function BotonPdfAgenda({ fecha, filtros }: BotonPdfAgendaProps) {
  const href = hrefPdfAgenda({ fecha, filtros })
  if (href === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Filtrá por profesor para generar el PDF de su agenda
      </p>
    )
  }

  return (
    <Button type="button" variant="accent" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <FileText />
        Generar PDF
        <span className="sr-only">(abre el PDF en otra pestaña)</span>
      </a>
    </Button>
  )
}
