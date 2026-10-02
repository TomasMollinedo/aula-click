'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  type FiltrosGlobal,
  type SeccionDeCuenta,
  leerFiltros,
  leerPaginas,
  paramsConFiltros,
  paramsConPagina,
  paramsSinFiltros,
} from '../filtros-cuenta'

/**
 * Los filtros de `cuentas` (período, materia, profesor y, en la vista global, alumno y la página de
 * cada tabla) guardados en la URL con `router.replace` sobre la ruta actual: Atrás y recargar
 * conservan lo que se veía, y los demás parámetros (`tab`, en la ficha) se mantienen. Cambiar un
 * filtro vuelve las dos tablas a la página 1. Sin debounce: cada filtro es una elección, no texto.
 */
export function useFiltrosCuenta() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const filtros = useMemo(() => leerFiltros(new URLSearchParams(texto)), [texto])
  const paginas = useMemo(() => leerPaginas(new URLSearchParams(texto)), [texto])

  const irA = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const cambiar = useCallback(
    (cambios: Partial<FiltrosGlobal>) =>
      irA(paramsConFiltros(new URLSearchParams(texto), { ...filtros, ...cambios })),
    [filtros, irA, texto],
  )

  const cambiarPagina = useCallback(
    (seccion: SeccionDeCuenta, page: number) =>
      irA(paramsConPagina(new URLSearchParams(texto), seccion, page)),
    [irA, texto],
  )

  const limpiar = useCallback(() => irA(paramsSinFiltros(new URLSearchParams(texto))), [irA, texto])

  return { filtros, paginas, cambiar, cambiarPagina, limpiar }
}
