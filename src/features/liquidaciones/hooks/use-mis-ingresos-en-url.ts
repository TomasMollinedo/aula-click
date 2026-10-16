'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { leerMesLiquidacion, paramsConPagina } from '../mes-liquidacion'
import {
  leerLiquidacionAbierta,
  leerPestana,
  paramsConLiquidacion,
  paramsConPestana,
  type PestanaMisIngresos,
} from '../mis-ingresos'

/**
 * Lo que "Mis ingresos" guarda en la URL: la pestaña (`?tab=`, con `replace`, como la ficha del
 * alumno), la liquidación abierta (`?liquidacion=AAAA-MM`, que Atrás cierra) y la página de "Mis
 * liquidaciones" (`?page=`, con `replace`). Las funciones puras están en `mis-ingresos.ts` y
 * `mes-liquidacion.ts`.
 */
export function useMisIngresosEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const params = new URLSearchParams(searchParams.toString())

  const conParams = (nuevos: URLSearchParams) => {
    const qs = nuevos.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  return {
    pestana: leerPestana(params),
    // Cada pestaña arranca en su página 1.
    cambiarPestana: (pestana: PestanaMisIngresos) =>
      router.replace(conParams(paramsConPagina(paramsConPestana(params, pestana), 1)), {
        scroll: false,
      }),
    liquidacionAbierta: leerLiquidacionAbierta(params),
    page: leerMesLiquidacion(params).page,
    /** La URL de la pantalla con esa liquidación abierta (o cerrada, con `null`). */
    hrefLiquidacion: (mes: string | null) => conParams(paramsConLiquidacion(params, mes)),
    cambiarPagina: (page: number) =>
      router.replace(conParams(paramsConPagina(params, page)), { scroll: false }),
  }
}
