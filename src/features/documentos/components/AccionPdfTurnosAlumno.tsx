'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type AccionPdfTurnosAlumnoProps = {
  alumnoId: number
  /** El mismo rango que se está viendo en la lista: el PDF tiene que coincidir con la pantalla. */
  desde: string
  hasta: string
}

/**
 * "Generar PDF" de los turnos de un alumno (pestaña "Turnos" de la ficha): abre la hoja de
 * impresión en una pestaña nueva, con el rango que ya está elegido en la lista. No es de ningún
 * ticket: se agregó aparte de T-60, con el mismo patrón (pestaña nueva, `useOcurrenciasDelAlumno`
 * y `DocumentoOficial` en la hoja).
 */
export function AccionPdfTurnosAlumno({ alumnoId, desde, hasta }: AccionPdfTurnosAlumnoProps) {
  const searchParams = new URLSearchParams({ desde, hasta })

  return (
    <Button type="button" variant="accent" asChild>
      <a
        href={`/mesa/alumnos/${alumnoId}/turnos/imprimir?${searchParams}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Printer />
        Generar PDF
      </a>
    </Button>
  )
}
