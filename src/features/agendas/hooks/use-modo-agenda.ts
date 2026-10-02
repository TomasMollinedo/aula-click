'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { type ModoAgenda, paramsConModo, parsearModo } from '../modo-agenda'

/**
 * Modo de la agenda (`?modo=lista`; el calendario no se escribe) guardado en la URL con `router.replace` sobre la ruta
 * actual, como los filtros: no se recuerda entre visitas, y los demás parámetros (fecha, vista,
 * filtros, tab) se conservan. Sin `modo` vale el calendario.
 */
export function useModoAgenda() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const modo = parsearModo(searchParams.get('modo'))

  const cambiarModo = useCallback(
    (nuevo: ModoAgenda) => {
      const qs = paramsConModo(new URLSearchParams(searchParams.toString()), nuevo).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return { modo, cambiarModo }
}
