'use client'

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { ReprogramarTurnoDialog } from './ReprogramarTurnoDialog'

export type AccionReprogramarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Reprogramar" en el pie del detalle (HU-20, T-50). Se muestra según
 * `ocurrencia.acciones.reprogramar.visible`, que calcula la API: nunca con reglas propias.
 */
export function AccionReprogramarTurno({ ocurrencia }: AccionReprogramarTurnoProps) {
  const [abierto, setAbierto] = useState(false)
  if (!ocurrencia.acciones.reprogramar.visible) return null

  return (
    <>
      <DetalleModalAccion type="button" variant="outline" onClick={() => setAbierto(true)}>
        <CalendarClock />
        Reprogramar
      </DetalleModalAccion>
      <ReprogramarTurnoDialog
        open={abierto}
        ocurrencia={ocurrencia}
        onCerrar={() => setAbierto(false)}
      />
    </>
  )
}
