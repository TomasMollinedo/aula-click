import {
  endOfISOWeek,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfISOWeek,
  startOfMonth,
} from 'date-fns'

import type { PeriodoTablero } from './tablero.types'

// El período del tablero en la URL y las opciones del selector. Funciones puras: este es el único
// lugar que conoce los nombres de los parámetros. Las fechas son `YYYY-MM-DD` y se leen con
// `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`; ninguna función usa `new Date()`:
// "hoy" se recibe. Qué cuenta cada indicador y si el período es válido (hasta anterior a desde, más
// de 366 días) lo decide la API: acá no se revalida.
//
// URL: sin parámetros, "Esta semana". `?periodo=hoy|mes` para esas opciones y
// `?periodo=rango&desde=&hasta=` para un rango propio.

export const OPCIONES_PERIODO = ['hoy', 'semana', 'mes', 'rango'] as const
export type OpcionPeriodo = (typeof OPCIONES_PERIODO)[number]

export const OPCION_POR_DEFECTO: OpcionPeriodo = 'semana'

export const ETIQUETA_OPCION: Record<OpcionPeriodo, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  rango: 'Personalizado',
}

/** Lo que se ve elegido: la opción y las dos fechas que le corresponden. */
export type PeriodoElegido = PeriodoTablero & { opcion: OpcionPeriodo }

const FORMATO = 'yyyy-MM-dd'

function esOpcion(valor: string | null): valor is OpcionPeriodo {
  return valor !== null && (OPCIONES_PERIODO as readonly string[]).includes(valor)
}

/** Una fecha real `YYYY-MM-DD` (`2026-02-30` y `30/09/2026` no lo son), o `null`. */
function fechaReal(valor: string | null): string | null {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const fecha = parseISO(valor)
  return isValid(fecha) && format(fecha, FORMATO) === valor ? valor : null
}

/** Las fechas de "Hoy", "Esta semana" (lunes a domingo, como la semana ISO) o "Este mes". */
function rangoDe(opcion: Exclude<OpcionPeriodo, 'rango'>, hoy: string): PeriodoTablero {
  const fecha = parseISO(hoy)
  switch (opcion) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }
    case 'semana':
      return {
        desde: format(startOfISOWeek(fecha), FORMATO),
        hasta: format(endOfISOWeek(fecha), FORMATO),
      }
    case 'mes':
      return {
        desde: format(startOfMonth(fecha), FORMATO),
        hasta: format(endOfMonth(fecha), FORMATO),
      }
  }
}

/**
 * El período de la opción elegida. Para `rango` se parte de `actual`: pasar a "Personalizado" deja
 * las mismas fechas que se estaban viendo, para que el rango empiece siendo válido.
 */
export function periodoDeOpcion(
  opcion: OpcionPeriodo,
  actual: PeriodoTablero,
  hoy: string,
): PeriodoElegido {
  return opcion === 'rango'
    ? { opcion, desde: actual.desde, hasta: actual.hasta }
    : { opcion, ...rangoDe(opcion, hoy) }
}

/**
 * El período de la URL. Un valor inválido (una opción desconocida, un `rango` sin las dos fechas
 * reales) cae en el período por defecto: la URL nunca rompe la pantalla.
 */
export function leerPeriodo(params: URLSearchParams, hoy: string): PeriodoElegido {
  const opcion = params.get('periodo')
  if (esOpcion(opcion) && opcion !== 'rango') return { opcion, ...rangoDe(opcion, hoy) }
  if (opcion === 'rango') {
    const desde = fechaReal(params.get('desde'))
    const hasta = fechaReal(params.get('hasta'))
    if (desde !== null && hasta !== null) return { opcion, desde, hasta }
  }
  return { opcion: OPCION_POR_DEFECTO, ...rangoDe('semana', hoy) }
}

/**
 * Los parámetros de la URL para mostrar `elegido`, a partir de los actuales (sin mutarlos): los
 * demás se conservan y el período por defecto no se escribe.
 */
export function paramsConPeriodo(
  actuales: URLSearchParams,
  elegido: PeriodoElegido,
): URLSearchParams {
  const params = new URLSearchParams(actuales)
  params.delete('periodo')
  params.delete('desde')
  params.delete('hasta')
  if (elegido.opcion === 'rango') {
    params.set('periodo', 'rango')
    params.set('desde', elegido.desde)
    params.set('hasta', elegido.hasta)
  } else if (elegido.opcion !== OPCION_POR_DEFECTO) {
    params.set('periodo', elegido.opcion)
  }
  return params
}
