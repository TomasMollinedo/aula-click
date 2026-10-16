'use client'

import { PagoDetalle } from '@/features/pagos/components/PagoDetalle'
import { RepartoDelPago } from '@/features/reparto/components/RepartoDelPago'

type DetallePagoProps = {
  pagoId: number
  onCerrar: () => void
}

// El detalle de un pago para el gerente (`?pago=<pagoId>`): solo lectura, con el reparto (HU-36, HU-43).
export function DetallePago({ pagoId, onCerrar }: DetallePagoProps) {
  return (
    <PagoDetalle
      pagoId={pagoId}
      onCerrar={onCerrar}
      renderReparto={(reparto) => <RepartoDelPago reparto={reparto} />}
    />
  )
}
