'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  normalizarFecha,
  paramsDeRango,
  parsearFecha,
  parsearVista,
  rangoDeVista,
  type VistaAgenda,
} from '../agenda-propia'

// El día que se propone al entrar sale del navegador (docs/arquitectura-frontend.md → Fechas y
// horas); qué turnos corresponden a cada fecha lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Vista (`?vista=dia|semana`) y fecha (`?fecha=`) de una agenda por rango, guardadas en la URL con
 * `router.replace` sobre la ruta actual, como los filtros del resto de los listados. Los demás
 * parámetros (por ejemplo `tab` en la ficha del profesor) se conservan, y los valores por defecto
 * (`vistaPorDefecto` y el rango de hoy) no se escriben. Una `vista` o una `fecha` inválidas caen en
 * el rango por defecto. Lo comparten "Mi agenda" y la agenda de la ficha del profesor.
 */
export function useRangoAgendaEnUrl({ vistaPorDefecto }: { vistaPorDefecto: VistaAgenda }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const hoy = fechaDeHoy()

  const vista = parsearVista(searchParams.get('vista'), vistaPorDefecto)
  const fecha = normalizarFecha(vista, parsearFecha(searchParams.get('fecha'), hoy))

  const cambiar = useCallback(
    (cambios: { vista?: VistaAgenda; fecha?: string }) => {
      const params = paramsDeRango(
        new URLSearchParams(searchParams.toString()),
        { vista: cambios.vista ?? vista, fecha: cambios.fecha ?? fecha },
        { vistaPorDefecto, hoy: fechaDeHoy() },
      )
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [fecha, pathname, router, searchParams, vista, vistaPorDefecto],
  )

  return { vista, fecha, rango: rangoDeVista(vista, fecha), hoy, cambiar }
}
