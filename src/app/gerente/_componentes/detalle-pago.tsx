'use client'

import { PagoDetalle } from '@/features/pagos/components/PagoDetalle'

type DetallePagoProps = {
  pagoId: number
  onCerrar: () => void
}

// El detalle de un pago para el gerente (`?pago=<pagoId>`): solo lectura, sin acciones (HU-36).
export function DetallePago({ pagoId, onCerrar }: DetallePagoProps) {
  return <PagoDetalle pagoId={pagoId} onCerrar={onCerrar} />
}
