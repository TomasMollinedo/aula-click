import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { hrefPdfTablero } from '../rutas-tablero'
import type { PeriodoTablero } from '../tablero.types'

/**
 * "Generar PDF" del tablero (HU-21): abre el PDF que arma la API (`hrefPdfTablero`) en una pestaña
 * nueva, en el visor del navegador, con el período que se está viendo, así el tablero queda como
 * estaba. Sin `periodo` (el que se ve no es válido: la API respondería el 400 en JSON) queda
 * deshabilitado. No pide datos: el documento lo calcula la API.
 */
export function BotonPdfTablero({ periodo }: { periodo: PeriodoTablero | null }) {
  if (periodo === null) {
    return (
      <Button type="button" variant="accent" disabled>
        <FileText />
        Generar PDF
      </Button>
    )
  }

  return (
    <Button type="button" variant="accent" asChild>
      <a href={hrefPdfTablero(periodo)} target="_blank" rel="noopener noreferrer">
        <FileText />
        Generar PDF
        <span className="sr-only">(abre el PDF en otra pestaña)</span>
      </a>
    </Button>
  )
}
