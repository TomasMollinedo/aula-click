import { format, getISODay, parseISO } from 'date-fns'

import { nombreDiaSemana } from '@/utils/dias-semana'
import { rangoHoras } from '@/utils/horas'

import type { TurnoVigenteProfesor } from './profesores.types'

// Los turnos vigentes que impiden dar de baja a un profesor (409 TURNOS_VIGENTES), preparados
// para mostrarlos: el resumen que encabeza el diálogo y el texto de la vigencia de cada turno.
// Sólo presentación: qué turnos impiden la baja lo decide la API. Las fechas son `YYYY-MM-DD` y
// se leen con `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`.

export type ResumenTurnosVigentes = {
  turnos: number
  alumnos: number
  /** Última fecha conocida, o `null` si hay algún recurrente sin fin (no se sabe hasta cuándo). */
  hasta: string | null
}

/** `'2026-09-28'` → `'28/09'`. */
function fechaCorta(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM')
}

/** Nombre del día de la semana de esa fecha, en minúscula (`'2026-09-28'` → `'lunes'`). */
function diaDe(fecha: string): string {
  return nombreDiaSemana(getISODay(parseISO(fecha))).toLowerCase()
}

/**
 * Plural del día para un turno que se repite: de lunes a viernes no cambia (`'los lunes'`), pero
 * sábado y domingo sí (`'los sábados'`).
 */
function diasDe(fecha: string): string {
  const dia = diaDe(fecha)
  return dia.endsWith('s') ? dia : `${dia}s`
}

/**
 * Cuántos turnos son, de cuántos alumnos y hasta cuándo llegan. `hasta` es `null` si alguno es un
 * recurrente sin fecha de fin: en ese caso no hay una última fecha que mostrar.
 */
export function resumenTurnosVigentes(
  turnos: readonly TurnoVigenteProfesor[],
): ResumenTurnosVigentes {
  const alumnos = new Set(turnos.map((turno) => turno.alumno.id))
  const sinFin = turnos.some((turno) => turno.fechaFin === null)
  const fechas = turnos.flatMap((turno) => (turno.fechaFin === null ? [] : [turno.fechaFin]))
  return {
    turnos: turnos.length,
    alumnos: alumnos.size,
    hasta: sinFin || fechas.length === 0 ? null : (fechas.sort().at(-1) ?? null),
  }
}

/**
 * La magnitud del problema en una línea, para el encabezado del diálogo:
 * `'Lorenzo Ríos tiene 46 turnos vigentes con 37 alumnos, hasta el 30/11.'`, o `'…, y alguno sin
 * fecha de fin.'` si hay un recurrente que sigue indefinidamente.
 */
export function textoResumenTurnos(quien: string, turnos: readonly TurnoVigenteProfesor[]): string {
  const resumen = resumenTurnosVigentes(turnos)
  const cuantos = resumen.turnos === 1 ? '1 turno vigente' : `${resumen.turnos} turnos vigentes`
  const conQuien = resumen.alumnos === 1 ? 'con 1 alumno' : `con ${resumen.alumnos} alumnos`
  const cuando =
    resumen.hasta === null ? 'y alguno sin fecha de fin' : `hasta el ${fechaCorta(resumen.hasta)}`
  return `${quien} tiene ${cuantos} ${conQuien}, ${cuando}.`
}

/**
 * Cuándo ocurre un turno, en una línea:
 * - sesión única: `'el lunes 28/09, de 9:00 a 10:00'`
 * - recurrente con fin: `'los lunes de 9:00 a 10:00, hasta el 30/11'`
 * - recurrente sin fin: `'los lunes de 9:00 a 10:00, sin fecha de fin'`
 */
export function textoVigencia(turno: TurnoVigenteProfesor): string {
  const horario = `de ${rangoHoras(turno.horaInicio, turno.horaFin)}`
  if (turno.tipo === 'SESION_UNICA') {
    return `el ${diaDe(turno.fecha)} ${fechaCorta(turno.fecha)}, ${horario}`
  }
  const dias = diasDe(turno.fecha)
  if (turno.fechaFin === null) return `los ${dias} ${horario}, sin fecha de fin`
  return `los ${dias} ${horario}, hasta el ${fechaCorta(turno.fechaFin)}`
}

/**
 * Agenda del mismo segmento de rol que el listado de profesores (`/mesa/profesores` →
 * `/mesa/agenda`): cada rol tiene su segmento y sus pantallas cuelgan de ahí
 * (docs/arquitectura-frontend.md → Roles y URLs), así que los componentes no lo escriben a mano.
 */
export function rutaAgendaDelSegmento(rutaProfesores: string): string {
  return `${rutaProfesores.replace(/\/[^/]+\/?$/, '')}/agenda`
}
