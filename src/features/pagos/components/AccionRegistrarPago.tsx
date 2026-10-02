'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { Banknote } from 'lucide-react'

import { DetalleModalAccion } from '@/components/ui/detalle-modal'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { SolicitudRegistrarPago } from '@/types/pago'

import { aCobrarDesdeDetalle } from '../a-cobrar'
import { RegistrarPagoDialog } from './RegistrarPagoDialog'

export type AccionRegistrarPagoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Registrar pago" en el pie del detalle del turno (HU-15). El botón se muestra solo según
 * `ocurrencia.acciones.registrarPago.visible`, que decide la API: ninguna regla propia.
 *
 * El diálogo se arma con una copia de la ocurrencia tomada al abrir y queda montado hasta que se
 * cierra, aunque el botón ya no se vea: registrar invalida el detalle, que vuelve con la acción
 * oculta, y el paso de éxito (o el rechazo) tiene que seguir en pantalla.
 *
 * Por lo mismo, al cerrarlo el botón que lo abrió puede no existir más y el foco quedaría fuera del
 * detalle: en ese caso va al modal que contiene esta acción (el detalle del turno), que se guarda
 * al abrir, mientras el botón todavía existe (así esta acción no suma al pie nada más que su
 * botón). Corre después del retorno de foco del `Dialog` (Radix lo hace en un `setTimeout` al
 * desmontarse), así el del botón gana cuando todavía sirve.
 */
export function AccionRegistrarPago({ ocurrencia }: AccionRegistrarPagoProps) {
  const [solicitud, setSolicitud] = useState<Omit<SolicitudRegistrarPago, 'onCerrar'> | null>(null)
  const [cierres, setCierres] = useState(0)
  const modalRef = useRef<HTMLElement | null>(null)

  const abrir = (evento: MouseEvent<HTMLButtonElement>) => {
    modalRef.current = evento.currentTarget.closest<HTMLElement>('[role="dialog"]')
    setSolicitud({ alumnoId: ocurrencia.alumno.id, ocurrencias: [aCobrarDesdeDetalle(ocurrencia)] })
  }

  const cerrar = () => {
    setSolicitud(null)
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
      {ocurrencia.acciones.registrarPago.visible && (
        <DetalleModalAccion type="button" onClick={abrir}>
          <Banknote />
          Registrar pago
        </DetalleModalAccion>
      )}
      {solicitud && <RegistrarPagoDialog {...solicitud} onCerrar={cerrar} />}
    </>
  )
}
