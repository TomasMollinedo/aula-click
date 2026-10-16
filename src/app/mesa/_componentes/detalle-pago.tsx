'use client'

import { AccionAnularPago } from '@/features/anulaciones/components/AccionAnularPago'
import { PagoDetalle } from '@/features/pagos/components/PagoDetalle'

type DetallePagoProps = {
  pagoId: number
  onCerrar: () => void
}

// El detalle de un pago para mesa de entradas (`?pago=<pagoId>`), con las acciones que otras
// features aportan: hoy "Anular pago". Se compone acá porque una feature no importa componentes de
// otra. Lo monta una sola vez el layout de mesa (`DetallePagoDesdeUrl`), para todas las pantallas
// que lo abren. Cada acción decide si se muestra con `pago.acciones`, que calcula la API.
export function DetallePago({ pagoId, onCerrar }: DetallePagoProps) {
  return (
    <PagoDetalle
      pagoId={pagoId}
      onCerrar={onCerrar}
      renderAcciones={(pago) => <AccionAnularPago pago={pago} />}
    />
  )
}
