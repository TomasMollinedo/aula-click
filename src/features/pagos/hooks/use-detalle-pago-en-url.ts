'use client'

import { useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { leerPagoId, paramsConPago, paramsSinPago } from '../detalle-pago-url'

/**
 * El detalle de un pago como modal con URL propia (`?pago=<pagoId>`), sobre la pantalla actual.
 * Lo usan las pantallas que lo abren (la ficha del alumno, "Pagos" de mesa y del gerente); qué se
 * muestra adentro y qué acciones lleva lo compone `app/` (`DetallePago`), que lo monta una sola
 * vez por pantalla.
 *
 * `abrir` hace `router.push`, así Atrás lo cierra, y `hrefPago` arma el mismo destino para un
 * `Link` (hay que llamar a `marcarAbiertoConLink` en su clic). `cerrar` es `router.back()` si se
 * abrió así en esta pestaña, o `router.replace` sin el pago si se entró por URL. Los demás
 * parámetros (`tab`, `vista`, filtros, `detalle`) se conservan.
 */
export function useDetallePagoEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const abiertoConLink = useRef(false)

  const pagoId = useMemo(
    () => leerPagoId(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const hrefPago = useCallback(
    (id: number) =>
      `${pathname}?${paramsConPago(new URLSearchParams(searchParams.toString()), id)}`,
    [pathname, searchParams],
  )

  const marcarAbiertoConLink = useCallback(() => {
    abiertoConLink.current = true
  }, [])

  const abrir = useCallback(
    (id: number) => {
      abiertoConLink.current = true
      router.push(hrefPago(id), { scroll: false })
    },
    [hrefPago, router],
  )

  const cerrar = useCallback(() => {
    if (abiertoConLink.current) {
      abiertoConLink.current = false
      router.back()
      return
    }
    const qs = paramsSinPago(new URLSearchParams(searchParams.toString())).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  return { pagoId, hrefPago, marcarAbiertoConLink, abrir, cerrar }
}
