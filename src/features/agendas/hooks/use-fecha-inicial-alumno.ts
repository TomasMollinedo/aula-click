'use client'

import { useState } from 'react'
import { format } from 'date-fns'

import { useOcurrenciasDelAlumno } from '@/features/ocurrencias/hooks/use-ocurrencias-del-alumno'

import { fechaDelPrimerTurno } from '../calendario-alumno'

/**
 * La semana en la que abre el calendario del alumno: la de su próximo turno (`fechaDelPrimerTurno`),
 * a partir de los turnos del año en curso (la lista por defecto de la API). `listo` es `false` hasta
 * que llegan: el calendario espera para no pedir la semana de hoy y saltar enseguida a otra. Si el
 * pedido falla o el alumno no tiene turnos, `fecha` es `null` y vale la semana de hoy.
 *
 * Se decide una sola vez por alumno y no se mueve: cancelar o reprogramar un turno vuelve a pedir
 * la lista, pero la pantalla no tiene que cambiar de semana sola.
 */
export function useFechaInicialAlumno(alumnoId: number): { fecha: string | null; listo: boolean } {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const anio = hoy.slice(0, 4)
  const query = useOcurrenciasDelAlumno({
    alumnoId,
    desde: `${anio}-01-01`,
    hasta: `${anio}-12-31`,
  })
  const [decidida, setDecidida] = useState<{ alumnoId: number; fecha: string | null } | null>(null)

  // Se decide cuando llegan los turnos (o falla el pedido) y se vuelve a decidir si cambia el alumno.
  // Ajustar el estado durante el render, con esta condición, es el patrón de React para derivar estado.
  const vigente = decidida?.alumnoId === alumnoId ? decidida : null
  if (vigente === null && (query.data !== undefined || query.isError)) {
    setDecidida({ alumnoId, fecha: fechaDelPrimerTurno(query.data ?? [], hoy) })
  }

  return { fecha: vigente?.fecha ?? null, listo: vigente !== null }
}
