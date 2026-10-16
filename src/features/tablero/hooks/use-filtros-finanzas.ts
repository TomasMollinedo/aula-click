'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  type FiltrosFinanzas,
  filtrosFinanzasConOrden,
  leerFiltrosFinanzas,
  paramsConFiltrosFinanzas,
} from '../filtros-finanzas'
import type { OrdenFinanzas } from '../tablero.types'

/**
 * El estado de la tabla por profesor de "Finanzas" (su página y su orden), guardado en la URL con
 * `router.replace`, como el período y los filtros del resto de las pantallas. Los valores por
 * defecto no se escriben y el período y la sección se conservan: cambiar de pestaña no pierde
 * ninguno de los dos.
 */
export function useFiltrosFinanzas() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const filtros = useMemo(() => leerFiltrosFinanzas(new URLSearchParams(texto)), [texto])

  const irA = useCallback(
    (nuevos: FiltrosFinanzas) => {
      const qs = paramsConFiltrosFinanzas(new URLSearchParams(texto), nuevos).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, texto],
  )

  const irAPagina = useCallback((page: number) => irA({ ...filtros, page }), [filtros, irA])

  const ordenarPor = useCallback(
    (columna: OrdenFinanzas) => irA(filtrosFinanzasConOrden(filtros, columna)),
    [filtros, irA],
  )

  return { filtros, irAPagina, ordenarPor }
}
