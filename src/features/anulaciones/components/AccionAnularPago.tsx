'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { Ban } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { PagoParaAcciones } from '@/types/pago'

import { AnularPagoDialog } from './AnularPagoDialog'

/** Lo mismo que dice la API en el 409 `TURNOS_DICTADOS` (decisión T-179). */
const MENSAJE_TURNOS_DICTADOS = 'No se puede anular: el pago incluye turnos que ya se dictaron'

export type AccionAnularPagoProps = {
  pago: PagoParaAcciones
}

/**
 * "Anular pago" en el pie del detalle del pago (HU-42). Se muestra según `pago.acciones.anular`,
 * que calcula la API: nunca con reglas propias. La compone `app/` (`renderAcciones` de
 * `PagoDetalle`, de `features/pagos`).
 *
 * Si el pago está vigente y la API no deja anularlo, el botón queda **deshabilitado con el motivo**
 * (en un tooltip y para lectores de pantalla), en lugar de desaparecer sin explicación. Esta acción
 * sólo la compone la mesa de entradas, así que un pago vigente con `anular: false` quiere decir una
 * sola cosa hoy: alguno de sus turnos ya se dictó (decisión T-179). Un pago anulado no lleva aviso:
 * su estado ya lo dice.
 *
 * El diálogo queda montado hasta que se cierra, aunque el botón ya no se vea: anular (y también su
 * 409) invalida el pago, que vuelve con la acción en `false`, y el error tiene que seguir en
 * pantalla. Por lo mismo, al cerrarlo el botón que lo abrió puede no existir más y el foco quedaría
 * fuera del detalle: en ese caso va al modal que contiene esta acción (el detalle del pago), que se
 * guarda al abrir. Corre después del retorno de foco del `Dialog` (Radix lo hace en un `setTimeout`),
 * así el del botón gana cuando todavía sirve.
 */
export function AccionAnularPago({ pago }: AccionAnularPagoProps) {
  const [abierto, setAbierto] = useState(false)
  const [cierres, setCierres] = useState(0)
  const modalRef = useRef<HTMLElement | null>(null)

  const abrir = (evento: MouseEvent<HTMLButtonElement>) => {
    modalRef.current = evento.currentTarget.closest<HTMLElement>('[role="dialog"]')
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setCierres((n) => n + 1)
  }

  useEffect(() => {
    if (cierres === 0) return
    const timeout = setTimeout(() => {
      const activo = document.activeElement
      if (activo && activo !== document.body && activo.isConnected) return
      modalRef.current?.focus()
    }, 0)
    return () => clearTimeout(timeout)
  }, [cierres])

  const bloqueadaPorTurnosDictados = pago.estado === 'VIGENTE' && !pago.acciones.anular

  return (
    <>
      {bloqueadaPorTurnosDictados && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Un botón deshabilitado no recibe el cursor ni el foco: el que los recibe es este
                  contenedor, que es el único elemento que esta acción aporta al pie. */}
              <span tabIndex={0} className="inline-flex rounded-md [&>button]:w-full">
                <DetalleModalAccion
                  type="button"
                  variant="destructive"
                  disabled
                  className="pointer-events-none"
                >
                  <Ban />
                  Anular pago
                </DetalleModalAccion>
                <span className="sr-only">{MENSAJE_TURNOS_DICTADOS}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{MENSAJE_TURNOS_DICTADOS}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {pago.acciones.anular && (
        <DetalleModalAccion type="button" variant="destructive" onClick={abrir}>
          <Ban />
          Anular pago
        </DetalleModalAccion>
      )}
      {abierto && <AnularPagoDialog open pago={pago} onCerrar={cerrar} />}
    </>
  )
}
