'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  type FiltrosHistorial,
  type OpcionPeriodo,
  type PeriodoHistorial,
  leerFiltros,
  paramsConFiltros,
  paramsSinFiltros,
  periodoConMesYAnio,
  periodoConRango,
  periodoDeOpcion,
} from '../filtros-historial'

// "Hoy" sale del navegador (docs/arquitectura-frontend.md → Fechas y horas): sólo propone el mes
// inicial, recorta un mes futuro y decide qué mes no hace falta escribir en la URL. Todo lo demás
// (qué clases caen en el período, el estado de cada una, los porcentajes) lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Los filtros del historial académico (período, materia y profesor) guardados en la URL con
 * `router.replace` sobre la ruta actual, como los filtros del resto de las pantallas: Atrás y
 * recargar conservan lo que se veía, y los demás parámetros (el `?tab=` de la ficha y el
 * `?detalle=&fecha=` del turno abierto) se mantienen. El mes en curso, que es el valor por defecto,
 * no se escribe.
 */
export function useFiltrosHistorial() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const hoy = fechaDeHoy()
  const filtros = useMemo(() => leerFiltros(new URLSearchParams(texto), hoy), [texto, hoy])

  const irA = useCallback(
    (nuevos: FiltrosHistorial) => {
      const qs = paramsConFiltros(new URLSearchParams(texto), nuevos, fechaDeHoy()).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, texto],
  )

  const cambiar = useCallback(
    (cambios: Partial<FiltrosHistorial>) => irA({ ...filtros, ...cambios }),
    [filtros, irA],
  )

  const cambiarPeriodo = useCallback((periodo: PeriodoHistorial) => cambiar({ periodo }), [cambiar])

  const elegirOpcion = useCallback(
    (opcion: OpcionPeriodo) => cambiarPeriodo(periodoDeOpcion(opcion, filtros.periodo)),
    [cambiarPeriodo, filtros.periodo],
  )

  // El mes se elige con dos selectores (mes del año y año) y cada uno conserva el otro.
  const elegirMes = useCallback(
    (numero: number) => cambiarPeriodo(periodoConMesYAnio(filtros.periodo, { numero }, hoy)),
    [cambiarPeriodo, filtros.periodo, hoy],
  )

  const elegirAnio = useCallback(
    (anio: number) => cambiarPeriodo(periodoConMesYAnio(filtros.periodo, { anio }, hoy)),
    [cambiarPeriodo, filtros.periodo, hoy],
  )

  const cambiarRango = useCallback(
    (cambios: { desde?: string; hasta?: string }) =>
      cambiarPeriodo(periodoConRango(filtros.periodo, cambios)),
    [cambiarPeriodo, filtros.periodo],
  )

  const limpiar = useCallback(() => {
    const qs = paramsSinFiltros(new URLSearchParams(texto), fechaDeHoy()).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, texto])

  return { filtros, hoy, cambiar, elegirOpcion, elegirMes, elegirAnio, cambiarRango, limpiar }
}
