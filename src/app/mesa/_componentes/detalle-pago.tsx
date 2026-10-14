'use client'

import { AccionAnularPago } from '@/features/anulaciones/components/AccionAnularPago'
import { PagoDetalle } from '@/features/pagos/components/PagoDetalle'

type DetallePagoProps = {
  pagoId: number
  onCerrar: () => void
}

// El detalle de un pago para mesa de entradas (`?pago=<pagoId>`), con las acciones que otras
// features aportan: hoy "Anular pago". Se compone acá porque una feature no importa componentes de
// otra. Cada pantalla que lo abre lo monta una sola vez, desde `useDetallePagoEnUrl` de
// `features/pagos` (la ficha del alumno y `/mesa/pagos`). Cada acción decide si se muestra con
// `pago.acciones`, que calcula la API.
export function DetallePago({ pagoId, onCerrar }: DetallePagoProps) {
  return (
    <PagoDetalle
      pagoId={pagoId}
      onCerrar={onCerrar}
      renderAcciones={(pago) => <AccionAnularPago pago={pago} />}
    />
  )
}
