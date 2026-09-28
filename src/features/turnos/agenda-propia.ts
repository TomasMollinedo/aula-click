import { addDays, format, getISODay, isValid, parseISO, startOfISOWeek } from 'date-fns'

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

/**
 * Vista que viene en la URL (`?vista=`); cualquier otra cosa cae en `porDefecto` (día en "Mi
 * agenda", semana en la ficha del profesor).
 */
export function parsearVista(
  valor: string | null | undefined,
  porDefecto: VistaAgenda = 'dia',
): VistaAgenda {
  return valor && esVista(valor) ? valor : porDefecto
}

/**
 * Fecha que viene en la URL (`?fecha=`): tiene que ser una fecha de calendario real `YYYY-MM-DD`
 * (`2026-02-30` no lo es). Cualquier otra cosa cae en `porDefecto` (hoy).
 */
export function parsearFecha(valor: string | null | undefined, porDefecto: string): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return porDefecto
  const fecha = parseISO(valor)
  return isValid(fecha) && formatearFecha(fecha) === valor ? valor : porDefecto
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
 * Query params de la URL para mostrar `vista` y `fecha`, a partir de los actuales (sin mutarlos):
 * conserva los demás (por ejemplo `tab` en la ficha del profesor) y omite los valores por defecto,
 * `vista` si es `vistaPorDefecto` y `fecha` si es el rango de `hoy`. La fecha va normalizada con
 * la vista nueva: pasar a semana guarda el lunes de ese día.
 */
export function paramsDeRango(
  actuales: URLSearchParams,
  { vista, fecha }: { vista: VistaAgenda; fecha: string },
  { vistaPorDefecto, hoy }: { vistaPorDefecto: VistaAgenda; hoy: string },
): URLSearchParams {
  const params = new URLSearchParams(actuales)
  const normalizada = normalizarFecha(vista, fecha)

  if (vista === vistaPorDefecto) params.delete('vista')
  else params.set('vista', vista)
  if (esRangoActual(vista, normalizada, hoy)) params.delete('fecha')
  else params.set('fecha', normalizada)

  return params
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
