'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { MODO_POR_DEFECTO, type ModoAgenda, paramsConModo, parsearModo } from '../modo-agenda'

/**
 * Modo de la agenda (`?modo=lista`; el calendario no se escribe) guardado en la URL con `router.replace` sobre la ruta
 * actual, como los filtros: no se recuerda entre visitas, y los demás parámetros (fecha, vista,
 * filtros, tab) se conservan. Sin `modo` vale el calendario, o `porDefecto` si la pantalla abre en
 * otro (ese es el que no se escribe).
 */
export function useModoAgenda(porDefecto: ModoAgenda = MODO_POR_DEFECTO) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const modo = parsearModo(searchParams.get('modo'), porDefecto)

  const cambiarModo = useCallback(
    (nuevo: ModoAgenda) => {
      const qs = paramsConModo(
        new URLSearchParams(searchParams.toString()),
        nuevo,
        porDefecto,
      ).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, porDefecto, router, searchParams],
  )

  return { modo, cambiarModo }
}
