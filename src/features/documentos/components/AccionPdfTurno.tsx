'use client'

import type { ComponentProps } from 'react'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { hrefPdfTurno } from '../rutas-documentos'

export type AccionPdfTurnoProps = {
  turnoId: number
  /** `YYYY-MM-DD` de la ocurrencia (la primera fecha del tramo, si viene de un alta). */
  fecha: string
}

/**
 * El enlace al PDF de un turno (`hrefPdfTurno`), en una pestaña nueva: el navegador lo abre en su
 * visor y la pantalla de origen queda intacta en la pestaña original. Sólo necesita `turnoId` y
 * `fecha`: el documento lo arma la API. El resto de las props son las que le pasa el botón que lo
 * envuelve (`asChild`).
 */
function EnlacePdfTurno({ turnoId, fecha, ...props }: AccionPdfTurnoProps & ComponentProps<'a'>) {
  return (
    <a href={hrefPdfTurno({ turnoId, fecha })} target="_blank" rel="noopener noreferrer" {...props}>
      <FileText />
      Generar PDF
      <span className="sr-only">(abre el PDF en otra pestaña)</span>
    </a>
  )
}

/**
 * "Generar PDF" de un turno (HU-11, T-60) en el encabezado de su detalle, al lado de la cruz de
 * cerrar (por eso mide lo mismo que ella y no es un `DetalleModalAccion`, que es del pie).
 */
export function AccionPdfTurno(props: AccionPdfTurnoProps) {
  return (
    <Button variant="accent" asChild>
      <EnlacePdfTurno {...props} />
    </Button>
  )
}

/** "Generar PDF" de un turno fuera del detalle: en la confirmación de un alta (T-69). */
export function BotonPdfTurno(props: AccionPdfTurnoProps) {
  return (
    <Button variant="accent" asChild>
      <EnlacePdfTurno {...props} />
    </Button>
  )
}
