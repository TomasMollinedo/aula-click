'use client'

import { format } from 'date-fns'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { PARAMETRO_FECHA, paramsDeFecha, parsearFechaAsistencia } from '../fecha-asistencia'

/**
 * El día de la pantalla, guardado en la URL (`?fecha=`) con `router.replace`: Atrás y recargar
 * conservan el día. Sin `fecha`, hoy.
 */
export function useFechaAsistencia() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const fecha = parsearFechaAsistencia(searchParams.get(PARAMETRO_FECHA), hoy)

  function cambiar(nueva: string) {
    const qs = paramsDeFecha(new URLSearchParams(searchParams.toString()), nueva, hoy).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { fecha, hoy, cambiar }
}
