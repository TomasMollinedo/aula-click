import { Receipt } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type PagosRealizadosProps = {
  /** El alumno de la ficha; sin él, la vista global (todos los alumnos). */
  alumnoId?: number
  /** Solo lectura, para el gerente: ve los pagos y sus detalles, sin acciones. */
  soloLectura?: boolean
  /** Abre el detalle de un pago; lo conecta `app/` con `useDetallePagoEnUrl().abrir`. */
  onAbrirPago: (pagoId: number) => void
}

/**
 * Subpestaña "Pagos realizados" (HU-36): en la ficha del alumno, en `/mesa/pagos` y en
 * `/gerente/pagos`. La completa T-100.
 */
export function PagosRealizados(props: PagosRealizadosProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={Receipt} title="Próximamente" />
    </Card>
  )
}
