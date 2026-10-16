'use client'

import { Suspense } from 'react'

import { useDetallePagoEnUrl } from '@/features/pagos/hooks/use-detalle-pago-en-url'

import { DetallePago } from './detalle-pago'

// El detalle de un pago de mesa de entradas (`?pago=<pagoId>`), montado una sola vez en el layout
// del segmento: lo abren "Pagos realizados" (la ficha del alumno y `/mesa/pagos`) y "Ver pago" del
// detalle de un turno pagado, que se abre desde las agendas, `/mesa/turnos`, la ficha del alumno y
// la del profesor. Así ninguna pantalla tiene que montarlo. Suspense: lee la URL con
// useSearchParams.
export function DetallePagoDesdeUrl() {
  return (
    <Suspense>
      <DetallePagoAbierto />
    </Suspense>
  )
}

function DetallePagoAbierto() {
  const { pagoId, cerrar } = useDetallePagoEnUrl()
  return pagoId !== null ? <DetallePago pagoId={pagoId} onCerrar={cerrar} /> : null
}
