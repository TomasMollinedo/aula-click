'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  type FiltrosAsistencia,
  filtrosConOrden,
  leerFiltrosAsistencia,
  paramsConFiltrosAsistencia,
} from '../filtros-asistencia'
import type { OrdenProfesores } from '../tablero.types'

/**
 * El estado de las dos tablas de "Asistencia" (la página de cada una, el orden de la de profesores
 * y "Sólo con turnos sin registrar"), guardado en la URL con `router.replace`, como el período y
 * los filtros del resto de las pantallas. Los valores por defecto no se escriben y el período y la
 * sección se conservan.
 *
 * Cada tabla pagina por separado: `irAProfesores` no mueve la página de materias y al revés.
 */
export function useFiltrosAsistencia() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const filtros = useMemo(() => leerFiltrosAsistencia(new URLSearchParams(texto)), [texto])

  const irA = useCallback(
    (nuevos: FiltrosAsistencia) => {
      const qs = paramsConFiltrosAsistencia(new URLSearchParams(texto), nuevos).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, texto],
  )

  const irAProfesores = useCallback(
    (paginaProfesores: number) => irA({ ...filtros, paginaProfesores }),
    [filtros, irA],
  )

  const irAMaterias = useCallback(
    (paginaMaterias: number) => irA({ ...filtros, paginaMaterias }),
    [filtros, irA],
  )

  const ordenarPor = useCallback(
    (columna: OrdenProfesores) => irA(filtrosConOrden(filtros, columna)),
    [filtros, irA],
  )

  // Cambiar el filtro vuelve a la primera página de profesores: es la única tabla que filtra.
  const cambiarSoloSinRegistrar = useCallback(
    (soloSinRegistrar: boolean) => irA({ ...filtros, soloSinRegistrar, paginaProfesores: 1 }),
    [filtros, irA],
  )

  return { filtros, irAProfesores, irAMaterias, ordenarPor, cambiarSoloSinRegistrar }
}
