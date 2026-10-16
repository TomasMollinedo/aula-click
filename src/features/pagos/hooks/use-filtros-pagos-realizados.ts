'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  type FiltrosPagosRealizados,
  leerFiltros,
  leerPagina,
  paramsConFiltros,
  paramsConPagina,
  paramsSinFiltros,
} from '../filtros-pagos-realizados'

// "Hoy" sale del navegador (docs/arquitectura-frontend.md → Fechas y horas): solo propone el mes
// en curso y decide qué período no hace falta escribir en la URL. Qué pagos caen en el período lo
// decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Los filtros de "Pagos realizados" (período, alumno en la vista global, materia, profesor y forma
 * de pago) y la página, guardados en la URL con `router.replace` sobre la ruta actual: Atrás y
 * recargar conservan lo que se veía, y los demás parámetros (`tab`, `vista`, `pago`) se mantienen.
 * Cambiar un filtro vuelve a la página 1. Sin debounce: cada filtro es una elección, no texto.
 */
export function useFiltrosPagosRealizados({ conAlumno }: { conAlumno: boolean }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const hoy = fechaDeHoy()
  const filtros = useMemo(
    () => leerFiltros(new URLSearchParams(texto), hoy, { conAlumno }),
    [texto, hoy, conAlumno],
  )
  const page = useMemo(() => leerPagina(new URLSearchParams(texto)), [texto])

  const irA = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const cambiar = useCallback(
    (cambios: Partial<FiltrosPagosRealizados>) =>
      irA(paramsConFiltros(new URLSearchParams(texto), { ...filtros, ...cambios }, fechaDeHoy())),
    [filtros, irA, texto],
  )

  const cambiarPagina = useCallback(
    (nueva: number) => irA(paramsConPagina(new URLSearchParams(texto), nueva)),
    [irA, texto],
  )

  const limpiar = useCallback(
    () => irA(paramsSinFiltros(new URLSearchParams(texto), fechaDeHoy())),
    [irA, texto],
  )

  return { filtros, page, hoy, cambiar, cambiarPagina, limpiar }
}
