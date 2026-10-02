'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  type OpcionPeriodo,
  type PeriodoElegido,
  leerPeriodo,
  paramsConPeriodo,
  periodoDeOpcion,
} from '../periodo'

// "Hoy" sale del navegador (docs/arquitectura-frontend.md → Fechas y horas): propone el período al
// entrar. Todo lo demás, qué turnos y pagos caen en él, lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * El período del tablero (`?periodo=`, y `desde` y `hasta` en uno personalizado), guardado en la URL
 * con `router.replace` sobre la ruta actual, como los filtros del resto de las pantallas: Atrás y
 * recargar lo conservan. "Esta semana" (el valor por defecto) no se escribe.
 */
export function usePeriodoEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const hoy = fechaDeHoy()
  const periodo = useMemo(() => leerPeriodo(new URLSearchParams(texto), hoy), [texto, hoy])

  const irA = useCallback(
    (elegido: PeriodoElegido) => {
      const qs = paramsConPeriodo(new URLSearchParams(texto), elegido).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, texto],
  )

  const elegir = useCallback(
    (opcion: OpcionPeriodo) => irA(periodoDeOpcion(opcion, periodo, fechaDeHoy())),
    [irA, periodo],
  )

  const cambiarRango = useCallback(
    (cambios: { desde?: string; hasta?: string }) =>
      irA({ ...periodo, ...cambios, opcion: 'rango' }),
    [irA, periodo],
  )

  return { periodo, elegir, cambiarRango }
}
