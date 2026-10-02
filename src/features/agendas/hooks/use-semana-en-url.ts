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
 *
 * `fechaPorDefecto` cambia cuál es esa semana "sin `fecha`" (la ficha del alumno abre en la de su
 * próximo turno): esa semana es la que no se escribe en la URL, y volver a la de hoy sí se escribe.
 */
export function useSemanaEnUrl({ fechaPorDefecto }: { fechaPorDefecto?: string } = {}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const hoy = fechaDeHoy()
  const porDefecto = fechaPorDefecto ?? hoy

  const fecha = normalizarFecha('semana', parsearFecha(searchParams.get('fecha'), porDefecto))

  function cambiar(nueva: string) {
    const params = paramsDeSemana(
      new URLSearchParams(searchParams.toString()),
      nueva,
      fechaPorDefecto ?? fechaDeHoy(),
    )
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { fecha, rango: rangoDeVista('semana', fecha), hoy, cambiar }
}
