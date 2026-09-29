'use client'

import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type PagosDelAlumnoProps = {
  alumnoId: number
  /**
   * El diálogo de registrar un pago. Lo compone `app/` (es de `features/pagos`): recibe lo que
   * necesita `RegistrarPagoDialog`.
   */
  renderRegistrarPago: (pago: {
    alumnoId: number
    ocurrencias: OcurrenciaDeAlumno[]
    onCerrar: () => void
  }) => ReactNode
}

/**
 * PLACEHOLDER de T-35, lo completa T-54: pestaña "Pagos" de la ficha del alumno (deuda, pagos
 * registrados y "Registrar pago").
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function PagosDelAlumno(_props: PagosDelAlumnoProps) {
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        Los pagos del alumno estarán disponibles próximamente.
      </p>
    </Card>
  )
}
