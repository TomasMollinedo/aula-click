'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

export type AccionPdfTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Generar PDF" en el pie del detalle (HU-11, T-60): abre la hoja de impresión del turno en una
 * pestaña nueva, así el detalle que estaba abierto queda intacto en la pestaña original (cancelar
 * o cerrar el diálogo de imprimir del navegador no se puede detectar: no hay forma de "volver
 * sola"). No pide datos: la hoja (`app/mesa/turnos/[turnoId]/imprimir`) los trae con
 * `useOcurrencia`, igual que este detalle.
 */
export function AccionPdfTurno({ ocurrencia }: AccionPdfTurnoProps) {
  return (
    <Button type="button" variant="accent" asChild>
      <a
        href={`/mesa/turnos/${ocurrencia.turnoId}/imprimir?fecha=${ocurrencia.fecha}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Printer />
        Generar PDF
      </a>
    </Button>
  )
}
