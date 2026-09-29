'use client'

import type { ReactNode } from 'react'

import { DetalleModal } from '@/components/ui/detalle-modal'
import type { OcurrenciaDetalle as OcurrenciaDetalleDatos } from '@/types/ocurrencia'

export type OcurrenciaDetalleProps = {
  turnoId: number
  /** Fecha **original** de la ocurrencia. */
  fecha: string
  onCerrar: () => void
  /**
   * Las acciones del pie. Las compone `app/` (`app/<segmento>/_componentes/detalle-turno.tsx`)
   * porque cada una es de otra feature, y cada una decide si se muestra con `ocurrencia.acciones`.
   */
  renderAcciones: (ocurrencia: OcurrenciaDetalleDatos) => ReactNode
}

/**
 * PLACEHOLDER de T-35, lo completa T-44: el detalle de un turno en una fecha (`?detalle=&fecha=`).
 * Hasta entonces solo abre el modal, así el alta y las agendas ya tienen dónde mostrarlo.
 */
export function OcurrenciaDetalle({ onCerrar }: OcurrenciaDetalleProps) {
  return (
    <DetalleModal titulo="Detalle del turno" descripcion="Próximamente" onCerrar={onCerrar}>
      <p className="text-muted-foreground text-sm">
        El detalle del turno estará disponible próximamente.
      </p>
    </DetalleModal>
  )
}
