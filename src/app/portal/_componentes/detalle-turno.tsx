'use client'

import { OcurrenciaDetallePortal } from '@/features/ocurrencias/components/OcurrenciaDetallePortal'
import type { SolicitudDetalleOcurrencia } from '@/types/ocurrencia'

/**
 * El detalle de un turno del alumno en el portal: de solo lectura y sin datos internos (T-84,
 * T-85). Lo abre "Mi calendario" (`renderDetalle`).
 */
export function DetalleTurnoPortal(props: SolicitudDetalleOcurrencia) {
  return <OcurrenciaDetallePortal {...props} />
}
