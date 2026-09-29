'use client'

import { OcurrenciaDetalle } from '@/features/ocurrencias/components/OcurrenciaDetalle'
import type { SolicitudDetalleOcurrencia } from '@/types/ocurrencia'

// El detalle de un turno para el profesor (`?detalle=<turnoId>&fecha=<fechaOriginal>`): de solo
// lectura, sin acciones (el profesor no cancela, finaliza, reprograma ni cobra en este incremento).
export function DetalleTurno({ turnoId, fecha, onCerrar }: SolicitudDetalleOcurrencia) {
  return (
    <OcurrenciaDetalle
      turnoId={turnoId}
      fecha={fecha}
      onCerrar={onCerrar}
      renderAcciones={() => null}
    />
  )
}
