'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { leerVista, paramsConVista } from '@/utils/vista-en-url'

type Opciones<T extends string> = {
  /** Las subpestañas, en el orden en que se ven. */
  valores: readonly T[]
  /** La que se ve sin `?vista=`. */
  porDefecto: T
  /** Los parámetros que sobreviven al cambiar de subpestaña (por ejemplo `tab`); el resto se va. */
  conservar?: readonly string[]
}

/**
 * La subpestaña activa de una pantalla (`?vista=`), guardada en la URL con `router.replace` (cambiar
 * de subpestaña no suma entradas al historial). Al cambiar, la URL se arma de cero con solo lo que
 * dice `conservar`: los filtros, las páginas y el detalle de la subpestaña anterior se van, como al
 * cambiar de pestaña. Va dentro de un `<Suspense>` (usa `useSearchParams`).
 */
export function useVistaEnUrl<T extends string>({
  valores,
  porDefecto,
  conservar = [],
}: Opciones<T>) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const vista = useMemo(
    () => leerVista(new URLSearchParams(texto), valores, porDefecto),
    [texto, valores, porDefecto],
  )

  const cambiar = useCallback(
    (nueva: T) => {
      const qs = paramsConVista(new URLSearchParams(texto), nueva, {
        porDefecto,
        conservar,
      }).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [conservar, pathname, porDefecto, router, texto],
  )

  return { vista, cambiar }
}
