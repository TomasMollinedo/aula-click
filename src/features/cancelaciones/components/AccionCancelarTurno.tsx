'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
            {/* El botón deshabilitado no recibe hover ni foco: el span sí. */}
            <span tabIndex={0} className="inline-flex" aria-describedby={ID_MOTIVO}>
              <Button type="button" variant="cancelado" disabled>
                Cancelar turno
              </Button>
            </span>
          </TooltipTrigger>
          {/* A la vista sólo con hover o foco: quien no ve lo lee del texto de abajo. */}
          <TooltipContent aria-hidden>{texto}</TooltipContent>
        </Tooltip>
        {/* Siempre en el DOM: el contenido del tooltip sólo existe mientras está abierto. */}
        <span id={ID_MOTIVO} className="sr-only">
          {texto}
        </span>
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
