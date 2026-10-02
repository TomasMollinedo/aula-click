'use client'

import { type RefObject, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'

/** La ocurrencia cuyo detalle se abre: `(turnoId, fecha)` (definición B). */
type Ocurrencia = { turnoId: number; fecha: string }

type Opciones = {
  /**
   * Adónde va el foco al cerrar el detalle si el botón que lo abrió ya no está (la fila se cobró,
   * se canceló o se reprogramó desde el detalle) o si se entró por URL: el mismo elemento estable
   * que usa `useDialogoDePago`, el título de la primera sección que se ve.
   */
  refugioRef: RefObject<HTMLElement | null>
  /**
   * Se llama al cerrar el detalle, con la ocurrencia que mostraba, para ajustar la selección. No
   * sabe qué se hizo adentro: cada pantalla lo deduce de sus propios datos.
   */
  alCerrar?: (ocurrencia: Ocurrencia) => void
}

/**
 * El detalle del turno abierto desde una fila de `cuentas` ("Ver detalle"): ahí se cobra ese turno
 * solo, y también se cancela o se reprograma. Va en la URL de la pantalla
 * (`?detalle=<turnoId>&fecha=`, `useDetalleEnUrl` de `ocurrencias`), junto a los filtros, las
 * páginas y el `tab` de la ficha, que se conservan al abrir y al cerrar. Qué se muestra adentro lo
 * compone `app/`.
 *
 * Devuelve `detalle` y `cerrar` para la pantalla que además lo monta (la vista global, con
 * `renderDetalle`); en la ficha lo monta `app/` para todas las pestañas y acá solo se abre.
 */
export function useDetalleDeCuenta({ refugioRef, alCerrar }: Opciones) {
  const { detalle, hrefDetalle, marcarAbiertoConLink, cerrar } = useDetalleEnUrl()
  const router = useRouter()
  const disparador = useRef<HTMLElement | null>(null)

  /** `boton`: el que lo abre, para devolverle el foco al cerrar. */
  const abrir = ({ turnoId, fecha }: Ocurrencia, boton: HTMLElement) => {
    disparador.current = boton
    marcarAbiertoConLink()
    router.push(hrefDetalle(turnoId, fecha), { scroll: false })
  }

  // El cierre se ve en la URL (también con Atrás), no en un callback: es el paso de "hay detalle" a
  // "no hay". `alCerrar` se lee del último render, para que vea los datos de ese momento.
  const alCerrarActual = useRef(alCerrar)
  useEffect(() => {
    alCerrarActual.current = alCerrar
  })
  const anterior = useRef(detalle)
  useEffect(() => {
    const cerrado = anterior.current
    anterior.current = detalle
    if (!cerrado || detalle) return

    alCerrarActual.current?.(cerrado)
    // El modal se monta desde la URL, no desde el botón, así que no le devuelve el foco solo. Va al
    // botón que lo abrió si sigue ahí y sirve; si no, al refugio. En un `setTimeout`, después del
    // retorno de foco del modal (Radix lo hace así al desmontarse).
    const timeout = setTimeout(() => {
      const boton = disparador.current
      disparador.current = null
      if (boton?.isConnected && !boton.matches(':disabled')) boton.focus()
      else refugioRef.current?.focus()
    }, 0)
    return () => clearTimeout(timeout)
  }, [detalle, refugioRef])

  return { abrir, detalle, cerrar }
}
