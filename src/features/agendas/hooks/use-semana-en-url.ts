'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import { normalizarFecha, parsearFecha, rangoDeVista } from '../agenda-propia'
import { paramsDeSemana } from '../calendario'

// El día que se propone al entrar sale del navegador (docs/arquitectura-frontend.md → Fechas y
// horas); qué turnos corresponden a cada fecha lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * La semana que muestra el calendario, guardada en la URL (`?fecha=`) con `router.replace` sobre la
 * ruta actual, como la lista: Atrás conserva la semana y los demás parámetros (modo, filtros, tab)
 * se mantienen. `fecha` es el lunes de la semana (la fecha de la URL puede ser cualquier día de
 * ella: la de la lista por día, o la de un turno abierto); sin `fecha`, la semana de hoy. Una fecha
 * inválida cae en la semana de hoy.
 */
export function useSemanaEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const hoy = fechaDeHoy()

  const fecha = normalizarFecha('semana', parsearFecha(searchParams.get('fecha'), hoy))

  function cambiar(nueva: string) {
    const params = paramsDeSemana(new URLSearchParams(searchParams.toString()), nueva, fechaDeHoy())
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { fecha, rango: rangoDeVista('semana', fecha), hoy, cambiar }
}
