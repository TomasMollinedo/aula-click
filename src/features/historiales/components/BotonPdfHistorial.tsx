'use client'

import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { FiltrosHistorial } from '../filtros-historial'
import { hrefPdfHistorial } from '../rutas-historiales'

export type BotonPdfHistorialProps = {
  alumnoId: number
  /** Los de la pantalla: el mes y los filtros de materia y profesor que se están viendo. */
  filtros: FiltrosHistorial
}

/**
 * "Generar PDF" del historial académico (HU-32), junto a los filtros de la pestaña: abre el PDF que
 * arma la API (`hrefPdfHistorial`) en una pestaña nueva, en el visor del navegador, con el mes y los
 * filtros tal cual están en la URL, así el historial queda intacto en la pestaña original. No pide
 * datos: el documento lo arma la API, con el mismo cálculo que la pantalla.
 *
 * Es sólo de **mesa de entradas** (lo decide quien lo monta, y el endpoint lo exige igual). El
 * documento es de **un mes**: con el período en "Rango de fechas" no se puede armar, así que en
 * lugar del botón va un aviso que dice qué hacer, como `BotonPdfAgenda` sin profesor elegido. El
 * mes no se deduce del rango: lo elige la persona.
 */
export function BotonPdfHistorial({ alumnoId, filtros }: BotonPdfHistorialProps) {
  const { periodo, materiaId, profesorId } = filtros
  if (periodo.opcion !== 'mes') {
    return (
      <p className="text-muted-foreground text-sm">
        Elegí un mes en el período para generar el PDF del historial
      </p>
    )
  }

  return (
    <Button type="button" variant="accent" asChild>
      <a
        href={hrefPdfHistorial({ alumnoId, mes: periodo.mes, materiaId, profesorId })}
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
