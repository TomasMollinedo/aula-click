'use client'

import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type PagosGlobalProps = {
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
 * PLACEHOLDER de T-35, lo completa T-54: la vista global de pagos y deuda de todos los alumnos
 * (`/mesa/pagos`).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function PagosGlobal(_props: PagosGlobalProps) {
  return (
    <Card>
      <p className="text-muted-foreground text-sm">Los pagos estarán disponibles próximamente.</p>
    </Card>
  )
}
