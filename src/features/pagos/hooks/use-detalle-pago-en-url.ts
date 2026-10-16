'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  crearRegistroDeAperturas,
  leerPagoId,
  paramsConPago,
  paramsSinPago,
} from '../detalle-pago-url'

// Uno por pestaña (el módulo se carga una vez): lo comparten todas las instancias del hook, porque
// quien abre el detalle y quien lo cierra no son la misma (mesa lo monta en su layout).
const aperturas = crearRegistroDeAperturas()

/**
 * El detalle de un pago como modal con URL propia (`?pago=<pagoId>`), sobre la pantalla actual.
 * Lo usan las pantallas que lo abren ("Pagos realizados", la caja del gerente) y quien lo muestra:
 * en mesa de entradas, `app/mesa/_componentes/detalle-pago-desde-url.tsx`, montado una sola vez en
 * el layout del segmento (así también lo abre el detalle de un turno, desde cualquier pantalla); en
 * el gerente, cada pantalla que lo abre. Qué se muestra adentro lo compone `app/` (`DetallePago`).
 *
 * `abrir` hace `router.push`, así Atrás lo cierra, y `hrefPago` arma el mismo destino para un
 * `Link` (hay que llamar a `marcarAbiertoConLink(pagoId)` en su clic). `cerrar` es `router.back()`
 * si ese pago se abrió así en esta pestaña (desde cualquier instancia del hook), o `router.replace`
 * sin el pago si se entró por URL. Los demás parámetros (`tab`, `vista`, filtros, `detalle`) se
 * conservan.
 */
export function useDetallePagoEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const pagoId = useMemo(
    () => leerPagoId(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // Cerrado por otro camino (Atrás del navegador): lo abierto con un clic ya no está.
  useEffect(() => {
    if (pagoId === null) aperturas.olvidar()
  }, [pagoId])

  const hrefPago = useCallback(
    (id: number) =>
      `${pathname}?${paramsConPago(new URLSearchParams(searchParams.toString()), id)}`,
    [pathname, searchParams],
  )

  const marcarAbiertoConLink = useCallback((id: number) => {
    aperturas.marcar(id)
  }, [])

  const abrir = useCallback(
    (id: number) => {
      aperturas.marcar(id)
      router.push(hrefPago(id), { scroll: false })
    },
    [hrefPago, router],
  )

  const cerrar = useCallback(() => {
    if (aperturas.cerrar(pagoId)) {
      router.back()
      return
    }
    const qs = paramsSinPago(new URLSearchParams(searchParams.toString())).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pagoId, pathname, router, searchParams])

  return { pagoId, hrefPago, marcarAbiertoConLink, abrir, cerrar }
}
