'use client'

import { FileText } from 'lucide-react'

import type { EstadoTurno } from '@/components/turno/indicadores-turno'
import { Button } from '@/components/ui/button'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

import { hrefPdfTurnosAlumno } from '../rutas-documentos'

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
 * "Generar PDF" de los turnos de un alumno (pestaña "Turnos" de la ficha): abre el PDF que arma la
 * API (`hrefPdfTurnosAlumno`) en una pestaña nueva, en el visor del navegador. No es de ningún
 * ticket: se agregó aparte de T-60.
 *
 * Con turnos tildados, manda `seleccion` (turnoId:fecha de cada uno) y el documento trae sólo esos,
 * ignorando el filtro de estado: una selección explícita ya dice exactamente qué va. Sin tildar
 * nada, manda `estado` (si hay uno elegido) para que el documento replique el filtro que se ve en
 * pantalla.
 */
export function AccionPdfTurnosAlumno(props: AccionPdfTurnosAlumnoProps) {
  return (
    <Button type="button" variant="accent" asChild>
      <a href={hrefPdfTurnosAlumno(props)} target="_blank" rel="noopener noreferrer">
        <FileText />
        Generar PDF
        <span className="sr-only">(abre el PDF en otra pestaña)</span>
      </a>
    </Button>
  )
}
