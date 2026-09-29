'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { FiltrosAgenda } from '@/types/agenda'

import { leerFiltros, paramsConFiltros } from '../filtros-agenda'

/**
 * Los filtros de la agenda (profesor, estado y prioridad) guardados en la URL con `router.replace`
 * sobre la ruta actual, como los filtros del resto de los listados: Atrás conserva lo que se veía y
 * los demás parámetros (fecha, vista, tab) se mantienen. Los consumen la lista y el calendario, así
 * un filtro vale en las dos vistas. Cambiar un filtro vuelve a la página 1.
 */
export function useFiltrosAgenda() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filtros = useMemo(
    () => leerFiltros(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const cambiar = useCallback(
    (cambios: Partial<FiltrosAgenda>) => {
      const qs = paramsConFiltros(new URLSearchParams(searchParams.toString()), {
        ...filtros,
        ...cambios,
      }).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [filtros, pathname, router, searchParams],
  )

  return { filtros, cambiar }
}
