'use client'

import { useEffect, useRef } from 'react'

/**
 * Si la página que se pide quedó pasada del final (se filtró, se cambió el período o se llegó por
 * un enlace), vuelve a la última que existe. Mira sólo respuestas frescas: con la anterior
 * atenuada (`enEspera`) la `meta` todavía es la de la otra consulta.
 *
 * Lo usan las tablas paginadas del tablero ("Asistencia" y "Finanzas"), una llamada por tabla: cada
 * una se corrige por separado, como en la vista global de `cuentas`.
 */
export function useCorregirPagina(
  meta: { totalPages: number } | undefined,
  page: number,
  enEspera: boolean,
  onPageChange: (page: number) => void,
) {
  const totalPages = enEspera ? undefined : meta?.totalPages
  const corregir = useRef(onPageChange)
  useEffect(() => {
    corregir.current = onPageChange
  })
  useEffect(() => {
    if (totalPages === undefined) return
    const ultima = Math.max(1, totalPages)
    if (page > ultima) corregir.current(ultima)
  }, [totalPages, page])
}
