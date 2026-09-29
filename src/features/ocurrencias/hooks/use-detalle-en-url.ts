'use client'

import { useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { leerDetalle, paramsConDetalle, paramsSinDetalle } from '../detalle-url'

/**
 * El detalle de una ocurrencia como modal con URL propia (`?detalle=<turnoId>&fecha=<original>`),
 * sobre la pantalla actual. Lo usan las pantallas que lo muestran (las agendas, el alta de turno,
 * la ficha del alumno) para no repetir el manejo de la URL; qué se muestra adentro lo compone
 * `app/` (`renderDetalle`).
 *
 * Se abre con un `Link` a `hrefDetalle(...)` (`push`: Atrás lo cierra) que llama a
 * `marcarAbiertoConLink` en el clic. `cerrar` es `router.back()` si se abrió así en esta pestaña, o
 * `router.replace` sin el detalle si se entró por URL. `fechaEsDeLaPantalla`: la pantalla usa
 * `?fecha=` para otra cosa (las agendas); al cerrar no se borra.
 */
export function useDetalleEnUrl({
  fechaEsDeLaPantalla = false,
}: { fechaEsDeLaPantalla?: boolean } = {}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const abiertoConLink = useRef(false)

  const detalle = useMemo(
    () => leerDetalle(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const hrefDetalle = useCallback(
    (turnoId: number, fecha: string) =>
      `${pathname}?${paramsConDetalle(new URLSearchParams(searchParams.toString()), { turnoId, fecha })}`,
    [pathname, searchParams],
  )

  const marcarAbiertoConLink = useCallback(() => {
    abiertoConLink.current = true
  }, [])

  const cerrar = useCallback(() => {
    if (abiertoConLink.current) {
      abiertoConLink.current = false
      router.back()
      return
    }
    const qs = paramsSinDetalle(new URLSearchParams(searchParams.toString()), {
      conservarFecha: fechaEsDeLaPantalla,
    }).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [fechaEsDeLaPantalla, pathname, router, searchParams])

  return { detalle, hrefDetalle, marcarAbiertoConLink, cerrar }
}
