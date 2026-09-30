'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { CancelarTurnosDialog } from './CancelarTurnosDialog'

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
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* El botón deshabilitado no recibe hover ni foco: el span sí. */}
            <span tabIndex={0} className="inline-flex" aria-describedby="cancelar-turno-motivo">
              <Button type="button" variant="cancelado" disabled>
                Cancelar turno
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent id="cancelar-turno-motivo">
            {motivo ?? 'El turno no se puede cancelar'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <Button type="button" variant="cancelado" onClick={() => setAbierto(true)}>
        Cancelar turno
      </Button>
      <CancelarTurnosDialog
        open={abierto}
        ocurrencias={[ocurrencia]}
        alumno={`${ocurrencia.alumno.nombre} ${ocurrencia.alumno.apellido}`}
        onCerrar={() => setAbierto(false)}
      />
    </>
  )
}
