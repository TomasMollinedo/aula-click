import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { hrefPdfCaja } from '../rutas-caja'

/**
 * "Generar PDF" de la caja diaria (HU-46): abre en una pestaña nueva el PDF que arma la API, con el
 * día que se está viendo, así la pantalla queda como estaba. El documento lleva la lista completa:
 * los filtros no van (los ignora la API). Sin día todavía (la respuesta no llegó o falló) queda
 * deshabilitado: no se pide un documento de una fecha que la API no aceptó.
 */
export function BotonPdfCaja({ fecha }: { fecha: string | null }) {
  if (fecha === null) {
    return (
      <Button type="button" variant="accent" disabled>
        <FileText />
        Generar PDF
      </Button>
    )
  }

  return (
    <Button type="button" variant="accent" asChild>
      <a href={hrefPdfCaja(fecha)} target="_blank" rel="noopener noreferrer">
        <FileText />
        Generar PDF
        <span className="sr-only">(abre el PDF en otra pestaña)</span>
      </a>
    </Button>
  )
}
