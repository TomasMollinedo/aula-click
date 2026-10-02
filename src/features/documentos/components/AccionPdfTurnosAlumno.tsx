'use client'

import { Printer } from 'lucide-react'

import type { EstadoTurno } from '@/components/turno/indicadores-turno'
import { Button } from '@/components/ui/button'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type AccionPdfTurnosAlumnoProps = {
  alumnoId: number
  /** El mismo mes (o año) que se está viendo en la lista: el PDF tiene que coincidir con la pantalla. */
  desde: string
  hasta: string
  /** El filtro de estado de la lista; `null` si está en "Todos los estados". */
  estado: EstadoTurno | null
  /** Turnos tildados en la lista. Con alguno, el PDF es sólo esos (T-67); sin ninguno, todo lo visible. */
  seleccionadas: OcurrenciaDeAlumno[]
}

/**
 * "Generar PDF" de los turnos de un alumno (pestaña "Turnos" de la ficha): abre la hoja de
 * impresión en una pestaña nueva. No es de ningún ticket: se agregó aparte de T-60, con el mismo
 * patrón (pestaña nueva, `useOcurrenciasDelAlumno` y `DocumentoOficial` en la hoja).
 *
 * Con turnos tildados, manda `seleccion` (turnoId:fecha de cada uno) y la hoja imprime sólo esos,
 * ignorando el filtro de estado: una selección explícita ya dice exactamente qué imprimir. Sin
 * tildar nada, manda `estado` (si hay uno elegido) para que la hoja replique el mismo filtro que se
 * ve en pantalla.
 */
export function AccionPdfTurnosAlumno({
  alumnoId,
  desde,
  hasta,
  estado,
  seleccionadas,
}: AccionPdfTurnosAlumnoProps) {
  const searchParams = new URLSearchParams({ desde, hasta })
  if (seleccionadas.length > 0) {
    searchParams.set('seleccion', seleccionadas.map((o) => `${o.turnoId}:${o.fecha}`).join(','))
  } else if (estado) {
    searchParams.set('estado', estado)
  }

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
