import type { FiltrosAgenda } from '@/types/agenda'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

import { armarGrilla, type GrillaSemanal, horaDe } from './calendario'

// El calendario semanal de la ficha del alumno. Solo presentación: qué turnos tiene, con qué estado y
// con qué prioridad lo decide la API (`GET /ocurrencias?alumnoId`); acá se ubican en la grilla de la
// semana y se aplican los filtros de cancelados y prioridad (los mismos de las agendas) sobre lo que
// llegó. Las fechas son `YYYY-MM-DD`; ninguna función usa `new Date()`: "hoy" se recibe.

/** Un turno del alumno ubicado en la grilla: `hora` es la hora en punto en la que cae (la fila). */
export type TurnoEnGrilla = OcurrenciaDeAlumno & { hora: number }

/**
 * Los turnos que pasan los filtros: sin `incluirCancelados` quedan las agendadas y las sin registrar,
 * como en las agendas, y `prioridad` deja solo las de esa prioridad. El filtro de profesor de las
 * agendas no aplica: el alumno es uno solo.
 */
export function filtrarTurnosDelAlumno(
  turnos: readonly OcurrenciaDeAlumno[],
  { incluirCancelados, prioridad }: Pick<FiltrosAgenda, 'incluirCancelados' | 'prioridad'>,
): OcurrenciaDeAlumno[] {
  return turnos.filter(
    (turno) =>
      (incluirCancelados || turno.estado !== 'CANCELADO') &&
      (prioridad === null || turno.prioridad === prioridad),
  )
}

/**
 * La fecha del turno en la que abre el calendario del alumno: el primero que tiene de `hoy` en
 * adelante o, si ya no le quedan, el último que tuvo. Las canceladas no cuentan (el calendario las
 * oculta por defecto). `null` si no tiene ninguna. No supone el orden en que llegan.
 */
export function fechaDelPrimerTurno(
  turnos: readonly OcurrenciaDeAlumno[],
  hoy: string,
): string | null {
  // `YYYY-MM-DD`: comparar los textos es comparar las fechas.
  const fechas = turnos.filter((t) => t.estado !== 'CANCELADO').map((t) => t.fecha)
  const proximas = fechas.filter((fecha) => fecha >= hoy)
  if (proximas.length > 0) return proximas.reduce((a, b) => (b < a ? b : a))
  return fechas.length > 0 ? fechas.reduce((a, b) => (b > a ? b : a)) : null
}

/**
 * Ubica los turnos de una semana en la grilla. Los días salen de los propios turnos, no de la semana
 * pedida (igual que `armarSemana`): mientras llega otra semana la grilla sigue mostrando la anterior
 * completa. Dentro de una celda quedan en el orden en que llegan (la API ordena por fecha y hora).
 */
export function armarSemanaDelAlumno(
  turnos: readonly OcurrenciaDeAlumno[],
  hoy: string,
): GrillaSemanal<TurnoEnGrilla> & { totalTurnos: number } {
  const enGrilla = turnos.map((turno) => ({ ...turno, hora: horaDe(turno.horaInicio) }))
  return { ...armarGrilla(enGrilla, hoy), totalTurnos: turnos.length }
}
