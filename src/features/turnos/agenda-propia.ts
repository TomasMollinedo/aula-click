import { addDays, format, getISODay, parseISO, startOfISOWeek } from 'date-fns'

import { nombreDiaSemana } from '@/utils/dias-semana'

import { fechaCorta } from './formato-turnos'
import type { AgendaPropiaItem } from './turnos.types'

// Vista por día o por semana de la agenda propia del profesor (HU-10). Solo presentación: qué
// turnos caen en cada fecha lo decide la API (`GET /turnos/agenda-propia` devuelve una entrada por
// ocurrencia, con su `fecha`). Las fechas son `YYYY-MM-DD` y se leen con `parseISO` (hora local),
// nunca con `new Date('YYYY-MM-DD')`. Ninguna función usa `new Date()`: "hoy" se recibe.

export const VISTAS_AGENDA = ['dia', 'semana'] as const

export type VistaAgenda = (typeof VISTAS_AGENDA)[number]

/** Un día de la agenda con sus turnos, para mostrarlos agrupados en la vista por semana. */
export type DiaDeAgenda = {
  fecha: string
  turnos: AgendaPropiaItem[]
}

function esVista(valor: string): valor is VistaAgenda {
  return (VISTAS_AGENDA as readonly string[]).includes(valor)
}

/** Vista que viene en la URL (`?vista=`); cualquier otra cosa cae en la vista por día. */
export function parsearVista(valor: string | null | undefined): VistaAgenda {
  return valor && esVista(valor) ? valor : 'dia'
}

/**
 * Fecha con la que se identifica el rango de la vista: en la vista por semana, el **lunes** de la
 * semana de `fecha` (ISO). Así, elegir un miércoles en el selector muestra su semana completa y la
 * URL siempre guarda el mismo día para el mismo rango.
 */
export function normalizarFecha(vista: VistaAgenda, fecha: string): string {
  if (vista === 'dia') return fecha
  return formatearFecha(startOfISOWeek(parseISO(fecha)))
}

/** Rango que se le pide a la API (`desde` / `hasta`, extremos incluidos). */
export function rangoDeVista(vista: VistaAgenda, fecha: string): { desde: string; hasta: string } {
  const desde = normalizarFecha(vista, fecha)
  if (vista === 'dia') return { desde, hasta: desde }
  return { desde, hasta: formatearFecha(addDays(parseISO(desde), 6)) }
}

/** Mueve el rango `pasos` lugares (un día o una semana, según la vista): -1 atrás, 1 adelante. */
export function moverRango(vista: VistaAgenda, fecha: string, pasos: number): string {
  const desde = normalizarFecha(vista, fecha)
  return formatearFecha(addDays(parseISO(desde), pasos * (vista === 'dia' ? 1 : 7)))
}

/** `true` si el rango mostrado es el de `hoy` (para deshabilitar "Hoy" / "Esta semana"). */
export function esRangoActual(vista: VistaAgenda, fecha: string, hoy: string): boolean {
  return normalizarFecha(vista, fecha) === normalizarFecha(vista, hoy)
}

/** Etiqueta del rango: `'Lunes'` en la vista por día, `'Semana del 28/09 al 04/10'` en la semanal. */
export function etiquetaDelRango(vista: VistaAgenda, fecha: string): string {
  if (vista === 'dia') return nombreDiaSemana(getISODay(parseISO(fecha)))
  const { desde, hasta } = rangoDeVista(vista, fecha)
  return `Semana del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`
}

/**
 * Agrupa las ocurrencias por fecha, conservando el orden en que vienen (la API las devuelve por
 * fecha y, dentro del día, por hora). Los días sin turnos no generan grupo.
 */
export function agruparPorFecha(items: readonly AgendaPropiaItem[]): DiaDeAgenda[] {
  const dias: DiaDeAgenda[] = []
  for (const turno of items) {
    const ultimo = dias.at(-1)
    if (ultimo?.fecha === turno.fecha) ultimo.turnos.push(turno)
    else dias.push({ fecha: turno.fecha, turnos: [turno] })
  }
  return dias
}

/** `Date` (hora local) → `YYYY-MM-DD`, el formato con el que la fecha viaja y vive en la UI. */
function formatearFecha(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd')
}
