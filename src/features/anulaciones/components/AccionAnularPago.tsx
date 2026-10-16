'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { Ban } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import type { PagoParaAcciones } from '@/types/pago'

import { AnularPagoDialog } from './AnularPagoDialog'

export type AccionAnularPagoProps = {
  pago: PagoParaAcciones
}

/**
 * "Anular pago" en el pie del detalle del pago (HU-42). Se muestra según `pago.acciones.anular`,
 * que calcula la API: nunca con reglas propias. La compone `app/` (`renderAcciones` de
 * `PagoDetalle`, de `features/pagos`).
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

  return (
    <>
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
