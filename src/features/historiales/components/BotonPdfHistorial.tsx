'use client'

import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { FiltrosHistorial } from '../filtros-historial'
import { hrefPdfHistorial } from '../rutas-historiales'

export type BotonPdfHistorialProps = {
  alumnoId: number
  /** Los de la pantalla: el período (un mes o un rango) y los filtros de materia y profesor. */
  filtros: FiltrosHistorial
}

/**
 * "Generar PDF" del historial académico (HU-32), en la fila de los filtros: abre el PDF que arma la
 * API (`hrefPdfHistorial`) en una pestaña nueva, en el visor del navegador, con **el período y los
 * filtros tal cual están en la URL** (un mes o un rango, decisión T-163), así el historial queda
 * intacto en la pestaña original. No pide datos: el documento lo arma la API, con el mismo cálculo
 * que la pantalla.
 *
 * Lo ven **mesa de entradas y el profesor**, los dos roles de la pestaña: el endpoint le deja al
 * profesor el documento de un alumno que tiene o tuvo turnos con él, el mismo criterio con el que
 * ve su historial.
 */
export function BotonPdfHistorial({ alumnoId, filtros }: BotonPdfHistorialProps) {
  const { periodo, materiaId, profesorId } = filtros

  return (
    <Button type="button" variant="accent" asChild>
      <a
        href={hrefPdfHistorial({ alumnoId, periodo, materiaId, profesorId })}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileText />
        Generar PDF
        <span className="sr-only">(abre el PDF en otra pestaña)</span>
      </a>
    </Button>
  )
}
