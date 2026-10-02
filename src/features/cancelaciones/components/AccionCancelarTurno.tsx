'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { CancelarTurnosDialog } from './CancelarTurnosDialog'

export type AccionCancelarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Cancelar este turno" en el pie del detalle. Se muestra según `ocurrencia.acciones.cancelar`, que
 * calcula la API: nunca con reglas propias. Solo aparece si se puede usar: un turno pagado, que la
 * API manda visible y deshabilitado, acá no la muestra.
 */
export function AccionCancelarTurno({ ocurrencia }: AccionCancelarTurnoProps) {
  const [abierto, setAbierto] = useState(false)
  const { visible, habilitada } = ocurrencia.acciones.cancelar
  if (!visible || !habilitada) return null

  return (
    <>
      <DetalleModalAccion type="button" variant="cancelado" onClick={() => setAbierto(true)}>
        <Ban />
        Cancelar este turno
      </DetalleModalAccion>
      <CancelarTurnosDialog
        open={abierto}
        ocurrencias={[ocurrencia]}
        alumno={`${ocurrencia.alumno.nombre} ${ocurrencia.alumno.apellido}`}
        onCerrar={() => setAbierto(false)}
      />
    </>
  )
}
