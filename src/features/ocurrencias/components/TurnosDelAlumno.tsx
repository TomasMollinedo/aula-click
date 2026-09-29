'use client'

import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type TurnosDelAlumnoProps = {
  alumnoId: number
  /**
   * Acciones sobre los turnos tildados (cancelar varios). Las compone `app/`: recibe lo que
   * necesita `AccionCancelarVarios`. `onListo` limpia la selección.
   */
  renderAccionesSeleccion: (seleccion: {
    alumnoId: number
    ocurrencias: OcurrenciaDeAlumno[]
    onListo: () => void
  }) => ReactNode
}

/**
 * PLACEHOLDER de T-35, lo completa T-44: pestaña "Turnos" de la ficha del alumno (lista de sus
 * ocurrencias, con selección de las cancelables).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function TurnosDelAlumno(_props: TurnosDelAlumnoProps) {
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        Los turnos del alumno estarán disponibles próximamente.
      </p>
    </Card>
  )
}
