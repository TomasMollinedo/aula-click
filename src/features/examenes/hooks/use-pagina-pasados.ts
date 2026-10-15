'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { leerPaginaPasados, paramsConPaginaPasados } from '../pagina-pasados'

/**
 * La página de los exámenes pasados, en la URL (`?pagePasados=`) con `router.replace`: Atrás y
 * recargar la conservan, y los demás parámetros (el `tab` de la ficha) se mantienen. Al cambiar de
 * pestaña, la ficha arma la URL de cero y la página se va sola.
 */
export function usePaginaPasados() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const page = leerPaginaPasados(searchParams)

  function cambiar(nueva: number) {
    const qs = paramsConPaginaPasados(
      new URLSearchParams(searchParams.toString()),
      nueva,
    ).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { page, cambiar }
}
