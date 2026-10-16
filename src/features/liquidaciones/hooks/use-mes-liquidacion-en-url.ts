'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  leerMesLiquidacion,
  paramsConMes,
  paramsConPagina,
  paramsConProfesor,
} from '../mes-liquidacion'

/**
 * El mes (`?mes=`), el profesor (`?profesorId=`) y la página (`?page=`) del listado de
 * liquidaciones, guardados en la URL con `router.replace` sobre la ruta actual, como el período
 * del tablero. `mesEnCurso` sale del navegador (docs/arquitectura-frontend.md → Fechas y horas),
 * solo para deshabilitar "Mes siguiente": qué mes es válido lo decide la API.
 */
export function useMesLiquidacionEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const { mes, profesorId, page } = useMemo(
    () => leerMesLiquidacion(new URLSearchParams(texto)),
    [texto],
  )

  const ir = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const elegirMes = useCallback(
    (nuevo: string) => ir(paramsConMes(new URLSearchParams(texto), nuevo)),
    [ir, texto],
  )

  const elegirProfesor = useCallback(
    (nuevo: number | null) => ir(paramsConProfesor(new URLSearchParams(texto), nuevo)),
    [ir, texto],
  )

  const cambiarPagina = useCallback(
    (nueva: number) => ir(paramsConPagina(new URLSearchParams(texto), nueva)),
    [ir, texto],
  )

  return {
    mes,
    profesorId,
    page,
    mesEnCurso: format(new Date(), 'yyyy-MM'),
    elegirMes,
    elegirProfesor,
    cambiarPagina,
  }
}
