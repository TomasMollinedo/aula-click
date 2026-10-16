'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  leerMesLiquidacion,
  paramsConEstado,
  paramsConMes,
  paramsConPagina,
  paramsConProfesor,
  paramsSinFiltros,
} from '../mes-liquidacion'
import type { EstadoLiquidacion } from '../liquidaciones.types'

/**
 * El mes (`?mes=`), los filtros por profesor (`?profesorId=`) y estado (`?estado=`) y la página
 * (`?page=`) del listado de liquidaciones, guardados en la URL con `router.replace` sobre la
 * ruta actual, como el período del tablero. `mesEnCurso` sale del navegador
 * (docs/arquitectura-frontend.md → Fechas y horas), solo para deshabilitar "Mes siguiente": qué mes
 * es válido lo decide la API.
 */
export function useMesLiquidacionEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const {
    mes: mesDeLaUrl,
    profesorId,
    estado,
    page,
  } = useMemo(() => leerMesLiquidacion(new URLSearchParams(texto)), [texto])
  // Sin `?mes=`, el mes en curso (el del navegador, solo para proponerlo: la API valida).
  const mesEnCurso = format(new Date(), 'yyyy-MM')
  const mes = mesDeLaUrl ?? mesEnCurso

  const ir = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  // Un mes posterior al actual (al cambiar de año con un mes que todavía no llegó) se recorta al actual.
  const elegirMes = useCallback(
    (nuevo: string) =>
      ir(paramsConMes(new URLSearchParams(texto), nuevo > mesEnCurso ? mesEnCurso : nuevo)),
    [ir, texto, mesEnCurso],
  )

  const elegirProfesor = useCallback(
    (nuevo: number | null) => ir(paramsConProfesor(new URLSearchParams(texto), nuevo)),
    [ir, texto],
  )

  const elegirEstado = useCallback(
    (nuevo: EstadoLiquidacion | null) => ir(paramsConEstado(new URLSearchParams(texto), nuevo)),
    [ir, texto],
  )

  const limpiarFiltros = useCallback(
    () => ir(paramsSinFiltros(new URLSearchParams(texto))),
    [ir, texto],
  )

  const cambiarPagina = useCallback(
    (nueva: number) => ir(paramsConPagina(new URLSearchParams(texto), nueva)),
    [ir, texto],
  )

  return {
    mes,
    profesorId,
    estado,
    page,
    mesEnCurso,
    elegirMes,
    elegirProfesor,
    elegirEstado,
    limpiarFiltros,
    cambiarPagina,
  }
}
