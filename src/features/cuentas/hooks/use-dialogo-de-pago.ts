import { type ReactNode, useEffect, useRef, useState } from 'react'

import type { SolicitudRegistrarPago } from '@/types/pago'

/** Lo que se le pasa al diálogo al abrirlo: una copia, que no depende de la lista de la cuenta. */
export type AperturaDePago = Omit<SolicitudRegistrarPago, 'onCerrar'>

type Opciones = {
  /** El diálogo de `pagos`, que compone `app/`. */
  renderRegistrarPago: (solicitud: SolicitudRegistrarPago) => ReactNode
  /**
   * Se llama al cerrar, con lo que se le pasó al abrir, para ajustar la selección. No sabe cómo
   * terminó el diálogo (pago, 409 o cancelación): cada pantalla lo deduce de sus propios datos.
   */
  alCerrar: (apertura: AperturaDePago) => void
}

/**
 * El diálogo de cobro abierto desde `cuentas` (HU-16), que invalida la misma lista que lo abrió:
 *
 * - **Copia al abrir.** Guarda la solicitud y deja el diálogo montado hasta `onCerrar`, aunque la
 *   fila cobrada desaparezca con la invalidación (ver `SolicitudRegistrarPago`).
 * - **Ajuste al cerrar.** `alCerrar` poda la selección (ficha) o saca esa solicitud (vista global).
 * - **Foco al cerrar.** El `Dialog` devuelve el foco al botón que lo abrió, pero si ese botón ya no
 *   está (la acción de una fila cobrada) o quedó deshabilitado ("Registrar pago" sin selección),
 *   el foco va a `refugioRef`: un elemento estable de la pantalla con `tabIndex={-1}`, como el
 *   título de la sección. Corre después del retorno de foco del `Dialog` (Radix lo hace en un
 *   `setTimeout` al desmontarse), así el del botón gana cuando todavía sirve.
 */
export function useDialogoDePago<T extends HTMLElement>({
  renderRegistrarPago,
  alCerrar,
}: Opciones) {
  const [apertura, setApertura] = useState<AperturaDePago | null>(null)
  const [cierres, setCierres] = useState(0)
  const disparador = useRef<HTMLElement | null>(null)
  const refugioRef = useRef<T>(null)

  const abrir = (solicitud: AperturaDePago, boton: HTMLElement) => {
    disparador.current = boton
    setApertura(solicitud)
  }

  const cerrar = () => {
    if (!apertura) return
    alCerrar(apertura)
    setApertura(null)
    setCierres((n) => n + 1)
  }

  useEffect(() => {
    if (cierres === 0) return
    const timeout = setTimeout(() => {
      const boton = disparador.current
      const sirve = boton?.isConnected && !boton.matches(':disabled')
      if (sirve) {
        if (document.activeElement !== boton) boton.focus()
      } else {
        refugioRef.current?.focus()
      }
    }, 0)
    return () => clearTimeout(timeout)
  }, [cierres])

  return {
    abrir,
    abierto: apertura !== null,
    refugioRef,
    /** Montarlo en la pantalla: `null` mientras no hay diálogo. */
    dialogo: apertura ? renderRegistrarPago({ ...apertura, onCerrar: cerrar }) : null,
  }
}
