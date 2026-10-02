'use client'

import type { ComponentProps } from 'react'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DetalleModalAccion } from '@/components/ui/detalle-modal'

export type AccionPdfTurnoProps = {
  turnoId: number
  /** `YYYY-MM-DD` de la ocurrencia (la primera fecha del tramo, si viene de un alta). */
  fecha: string
}

/**
 * El enlace a la hoja de impresión de un turno, en una pestaña nueva: así la pantalla de origen
 * queda intacta en la pestaña original (cancelar o cerrar el diálogo de imprimir del navegador no
 * se puede detectar: no hay forma de "volver sola"). Sólo necesita `turnoId` y `fecha`: la hoja
 * (`app/mesa/turnos/[turnoId]/imprimir`) trae el resto con `useOcurrencia`. El resto de las props
 * son las que le pasa el botón que lo envuelve (`asChild`).
 */
function EnlacePdfTurno({ turnoId, fecha, ...props }: AccionPdfTurnoProps & ComponentProps<'a'>) {
  return (
    <a
      href={`/mesa/turnos/${turnoId}/imprimir?fecha=${fecha}`}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      <Printer />
      Generar PDF
    </a>
  )
}

/** "Generar PDF" de un turno (HU-11, T-60) en el pie de su detalle. */
export function AccionPdfTurno(props: AccionPdfTurnoProps) {
  return (
    <DetalleModalAccion variant="accent" asChild>
      <EnlacePdfTurno {...props} />
    </DetalleModalAccion>
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
