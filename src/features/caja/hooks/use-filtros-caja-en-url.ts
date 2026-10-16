'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

import {
  fechaElegible,
  leerFiltrosCaja,
  paramsConFiltros,
  paramsSinFiltros,
  type FiltrosCaja,
} from '../filtros-caja'

// "Hoy" sale del navegador (docs/arquitectura-frontend.md → Fechas y horas): decide hasta dónde se
// puede avanzar con "Día siguiente" y qué fecha no hace falta escribir en la URL. Qué día es hoy
// para la caja lo decide la API, que lo devuelve en `data.fecha`.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * El día (`?fecha=`) y los filtros (`?tipo=`, `?formaPago=`) de la caja diaria, guardados en la URL
 * con `router.replace` sobre la ruta actual, como los filtros del resto de las pantallas: Atrás y
 * recargar conservan lo que se veía, y los demás parámetros (`pago`, el detalle del pago abierto)
 * se mantienen. El día de hoy no se escribe: sin `fecha`, la caja es la de hoy, la que decide la
 * API.
 *
 * `irAFecha` recorta una fecha futura a hoy (`fechaElegible`): no se consulta un día que todavía no
 * existe. Es comodidad de la UI; la API valida igual.
 */
export function useFiltrosCajaEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const hoy = fechaDeHoy()
  const filtros = useMemo(() => leerFiltrosCaja(new URLSearchParams(texto)), [texto])

  const irA = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const cambiar = useCallback(
    (cambios: Partial<FiltrosCaja>) =>
      irA(paramsConFiltros(new URLSearchParams(texto), { ...filtros, ...cambios }, fechaDeHoy())),
    [filtros, irA, texto],
  )

  const irAFecha = useCallback(
    (fecha: string) => cambiar({ fecha: fechaElegible(fecha, fechaDeHoy()) }),
    [cambiar],
  )

  const limpiar = useCallback(
    () => irA(paramsSinFiltros(new URLSearchParams(texto), filtros, fechaDeHoy())),
    [filtros, irA, texto],
  )

  return { filtros, hoy, irAFecha, cambiar, limpiar }
}
