'use client'

import type { ReactNode } from 'react'

import { AgendaConModo } from './AgendaConModo'
import { CalendarioAlumno } from './CalendarioAlumno'

type AgendaDelAlumnoProps = {
  alumnoId: number
  /**
   * La vista "Lista": la lista de turnos del alumno (`TurnosDelAlumno`, de `features/ocurrencias`).
   * La compone `app/` porque `features/agendas` no puede importar componentes de otra feature. Solo
   * se monta en ese modo.
   */
  children: ReactNode
}

/**
 * La pestaña "Turnos" de la ficha del alumno como una agenda: el calendario semanal por defecto y la
 * lista de turnos como alternativa, con el selector "Calendario / Lista" a la altura de las
 * pestañas (modo, semana y filtros en la URL, como en la ficha del profesor). No monta el detalle del
 * turno: la ficha ya tiene uno solo para todas sus pestañas (`ficha-alumno.tsx`).
 */
export function AgendaDelAlumno({ alumnoId, children }: AgendaDelAlumnoProps) {
  return (
    <AgendaConModo
      enEncabezado="pestanas"
      renderCalendario={(filtros) => <CalendarioAlumno alumnoId={alumnoId} filtros={filtros} />}
    >
      {children}
    </AgendaConModo>
  )
}
