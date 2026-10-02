'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { CancelarTurnosDialog } from './CancelarTurnosDialog'

const ID_MOTIVO = 'cancelar-turno-motivo'

export type AccionCancelarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Cancelar turno" en el pie del detalle. Se muestra según `ocurrencia.acciones.cancelar` (visible
 * / habilitada / motivo), que calcula la API: nunca con reglas propias. Deshabilitada (un turno
 * pagado), explica por qué con el `motivo` de la API, tal cual.
 */
export function AccionCancelarTurno({ ocurrencia }: AccionCancelarTurnoProps) {
  const [abierto, setAbierto] = useState(false)
  const { visible, habilitada, motivo } = ocurrencia.acciones.cancelar
  if (!visible) return null

  if (!habilitada) {
    const texto = motivo ?? 'El turno no se puede cancelar'
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* El botón deshabilitado no recibe hover ni foco: el span sí. Es el único elemento
                que esta acción aporta al pie (`DetalleModal`), y el botón lo ocupa entero. */}
            <span tabIndex={0} className="flex" aria-describedby={ID_MOTIVO}>
              <DetalleModalAccion type="button" variant="cancelado" className="flex-1" disabled>
                <Ban />
                Cancelar turno
              </DetalleModalAccion>
              {/* Siempre en el DOM: el contenido del tooltip sólo existe mientras está abierto. */}
              <span id={ID_MOTIVO} className="sr-only">
                {texto}
              </span>
            </span>
          </TooltipTrigger>
          {/* A la vista sólo con hover o foco: quien no ve lo lee del texto de arriba. */}
          <TooltipContent aria-hidden>{texto}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <DetalleModalAccion type="button" variant="cancelado" onClick={() => setAbierto(true)}>
        <Ban />
        Cancelar turno
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
