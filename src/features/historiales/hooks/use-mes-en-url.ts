'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import { mesDe } from '../filtros-historial'
import { parsearMes } from '../mis-materias'

// "Hoy" sale del navegador (docs/arquitectura-frontend.md → Fechas y horas).
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * El mes que muestra el historial de una materia del portal, en la URL (`?mes=AAAA-MM`) con
 * `router.replace`. Sin `mes` (o con uno inválido o futuro), el mes en curso, que no se escribe.
 */
export function useMesEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const hoy = fechaDeHoy()
  const mes = parsearMes(searchParams.get('mes'), hoy)

  function cambiar(nuevo: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nuevo === mesDe(fechaDeHoy())) params.delete('mes')
    else params.set('mes', nuevo)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { mes, esActual: mes === mesDe(hoy), cambiar }
}
