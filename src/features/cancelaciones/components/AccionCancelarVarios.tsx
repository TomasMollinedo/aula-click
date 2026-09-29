'use client'

import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type AccionCancelarVariosProps = {
  alumnoId: number
  /** Las ocurrencias tildadas en la pestaña "Turnos" (todas cancelables, del mismo alumno). */
  ocurrencias: OcurrenciaDeAlumno[]
  /** Terminó (canceló o se descartó): quien la muestra limpia la selección. */
  onListo: () => void
}

/**
 * PLACEHOLDER de T-35, lo completa T-46: "Cancelar seleccionados" de la pestaña "Turnos" de la
 * ficha del alumno.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function AccionCancelarVarios(_props: AccionCancelarVariosProps) {
  return null
}
