'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type AccionPdfTurnoProps = {
  turnoId: number
  /** `YYYY-MM-DD` de la ocurrencia (la primera fecha del tramo, si viene de un alta). */
  fecha: string
}

/**
 * "Generar PDF" de un turno (HU-11, T-60): abre la hoja de impresión en una pestaña nueva, así la
 * pantalla de origen (el detalle, o la confirmación de un alta, T-69) queda intacta en la pestaña
 * original (cancelar o cerrar el diálogo de imprimir del navegador no se puede detectar: no hay
 * forma de "volver sola"). Sólo necesita `turnoId` y `fecha`: la hoja (`app/mesa/turnos/[turnoId]/
 * imprimir`) trae el resto con `useOcurrencia`.
 */
export function AccionPdfTurno({ turnoId, fecha }: AccionPdfTurnoProps) {
  return (
    <Button type="button" variant="accent" asChild>
      <a
        href={`/mesa/turnos/${turnoId}/imprimir?fecha=${fecha}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Printer />
        Generar PDF
      </a>
    </Button>
  )
}
