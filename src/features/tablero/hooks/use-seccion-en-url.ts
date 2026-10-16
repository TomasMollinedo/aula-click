'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { type Seccion, leerSeccion, paramsConSeccion } from '../seccion'

/**
 * La sección del tablero (`?seccion=`, "General" por defecto), guardada en la URL con
 * `router.replace` sobre la ruta actual, como el período y los filtros del resto de las pantallas:
 * Atrás y recargar conservan la pestaña que se estaba viendo.
 *
 * Al cambiar de pestaña **el resto de la URL se conserva**: el período vale para las dos secciones
 * y el estado de las tablas de "Asistencia" sigue ahí al volver.
 */
export function useSeccionEnUrl() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const texto = searchParams.toString()
  const seccion = useMemo(() => leerSeccion(new URLSearchParams(texto)), [texto])

  const cambiar = useCallback(
    (nueva: Seccion) => {
      const qs = paramsConSeccion(new URLSearchParams(texto), nueva).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, texto],
  )

  return { seccion, cambiar }
}
