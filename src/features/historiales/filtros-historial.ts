import { endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns'

import {
  ANIOS_OFRECIDOS,
  MESES_DEL_ANIO,
  anioDe,
  aniosOfrecidos,
  esMesFuturo,
  etiquetaNumeroMes,
  mesDeAnioYNumero,
  numeroDeMes,
} from '@/utils/meses'

import type { HistorialParams } from './historiales.types'

// Los selectores de mes y año son de `utils/meses.ts` (los usa también el listado de
// liquidaciones); se re-exportan para quien ya los importaba de acá.
export {
  ANIOS_OFRECIDOS,
  MESES_DEL_ANIO,
  anioDe,
  aniosOfrecidos,
  esMesFuturo,
  etiquetaNumeroMes,
  mesDeAnioYNumero,
  numeroDeMes,
}

// Los filtros del historial académico en la URL. Funciones puras: este es el único lugar que conoce
// los nombres de los parámetros y sus valores válidos. Las fechas son `YYYY-MM-DD` y se leen con
// `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`; ninguna función usa `new Date()`:
// "hoy" se recibe (docs/arquitectura-frontend.md → Fechas y horas).
//
// URL, junto al `?tab=historial` de la ficha: sin parámetros, el **mes en curso**. `?mes=2026-09`
// para otro mes y `?desde=&hasta=` para un rango propio, más `?materiaId=` y `?profesorId=`. El mes
// se elige con **dos** selectores (mes del año y año), pero en la URL y en el estado sigue siendo
// un solo `YYYY-MM`.
//
// El período no se revalida acá: un `hasta` anterior al `desde`, o un rango de más de 366 días, los
// rechaza la API con un 400 sobre `hasta` (decisión T-147).

export const OPCIONES_PERIODO = ['mes', 'rango'] as const
export type OpcionPeriodo = (typeof OPCIONES_PERIODO)[number]

export const ETIQUETA_OPCION: Record<OpcionPeriodo, string> = {
  mes: 'Un mes',
  rango: 'Rango de fechas',
}

const FORMATO_FECHA = 'yyyy-MM-dd'
const FORMATO_MES = 'yyyy-MM'

/**
 * El período que se ve: la opción elegida, el mes (`YYYY-MM`) y las dos fechas que le corresponden.
 * Con `opcion: 'mes'`, `desde` y `hasta` son los bordes de `mes`; con `rango`, son los elegidos y
 * `mes` es el del `desde`, para que volver a "Un mes" caiga en el mes que se estaba viendo.
 */
export type PeriodoHistorial = {
  opcion: OpcionPeriodo
  mes: string
  desde: string
  hasta: string
}

export type FiltrosHistorial = {
  periodo: PeriodoHistorial
  materiaId: number | null
  profesorId: number | null
}

/** El mes (`YYYY-MM`) de una fecha `YYYY-MM-DD`. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

/** Primer y último día de un mes `YYYY-MM`. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const primero = parseISO(`${mes}-01`)
  return {
    desde: format(startOfMonth(primero), FORMATO_FECHA),
    hasta: format(endOfMonth(primero), FORMATO_FECHA),
  }
}

/** Una fecha real `YYYY-MM-DD` (`2026-02-30` y `30/09/2026` no lo son), o `null`. */
function fechaReal(valor: string | null): string | null {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const fecha = parseISO(valor)
  return isValid(fecha) && format(fecha, FORMATO_FECHA) === valor ? valor : null
}

/** Un mes real `YYYY-MM` (`2026-13` no lo es), o `null`. */
function mesReal(valor: string | null): string | null {
  if (valor === null || !/^\d{4}-\d{2}$/.test(valor)) return null
  const fecha = parseISO(`${valor}-01`)
  return isValid(fecha) && format(fecha, FORMATO_MES) === valor ? valor : null
}

/** Un entero >= 1, o `null` si no viene o no es válido. */
function enteroPositivo(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null
}

/** El período por defecto: el mes en curso completo. */
export function periodoPorDefecto(hoy: string): PeriodoHistorial {
  const mes = mesDe(hoy)
  return { opcion: 'mes', mes, ...rangoDelMes(mes) }
}

/**
 * El período de la opción elegida. Pasar a "Rango de fechas" deja las mismas fechas que se estaban
 * viendo, para que el rango empiece siendo válido; volver a "Un mes" cae en el mes del `desde`.
 */
export function periodoDeOpcion(opcion: OpcionPeriodo, actual: PeriodoHistorial): PeriodoHistorial {
  if (opcion === 'rango') return { ...actual, opcion }
  const mes = mesDe(actual.desde)
  return { opcion, mes, ...rangoDelMes(mes) }
}

/** El período con otro mes elegido (su rango se recalcula). */
export function periodoConMes(mes: string): PeriodoHistorial {
  return { opcion: 'mes', mes, ...rangoDelMes(mes) }
}

/**
 * El período con otro mes del año o otro año elegido (el que no se cambia se conserva). Si la
 * combinación cae después del mes en curso —cambiar al año actual estando en diciembre, por
 * ejemplo—, se recorta al mes en curso: el historial llega hasta hoy.
 */
export function periodoConMesYAnio(
  actual: PeriodoHistorial,
  cambios: { numero?: number; anio?: number },
  hoy: string,
): PeriodoHistorial {
  const anio = cambios.anio ?? anioDe(actual.mes)
  const numero = cambios.numero ?? numeroDeMes(actual.mes)
  const mes = mesDeAnioYNumero(anio, numero)
  return periodoConMes(esMesFuturo(mes, hoy) ? mesDe(hoy) : mes)
}

/** El período con otro extremo del rango; el mes acompaña al `desde`. */
export function periodoConRango(
  actual: PeriodoHistorial,
  cambios: { desde?: string; hasta?: string },
): PeriodoHistorial {
  const desde = cambios.desde ?? actual.desde
  const hasta = cambios.hasta ?? actual.hasta
  return { opcion: 'rango', mes: mesDe(desde), desde, hasta }
}

/**
 * Los filtros de la URL. Un valor inválido (un mes o una fecha que no existen, un id que no es un
 * entero positivo, una opción desconocida) es "sin filtro" y el período cae en el mes en curso: la
 * URL nunca rompe la pantalla. El rango necesita las **dos** fechas; con una sola, también cae en
 * el mes en curso.
 */
export function leerFiltros(params: URLSearchParams, hoy: string): FiltrosHistorial {
  const materiaId = enteroPositivo(params.get('materiaId'))
  const profesorId = enteroPositivo(params.get('profesorId'))
  const desde = fechaReal(params.get('desde'))
  const hasta = fechaReal(params.get('hasta'))
  const mes = mesReal(params.get('mes'))

  if (desde !== null && hasta !== null) {
    return { periodo: { opcion: 'rango', mes: mesDe(desde), desde, hasta }, materiaId, profesorId }
  }
  if (mes !== null) return { periodo: periodoConMes(mes), materiaId, profesorId }
  return { periodo: periodoPorDefecto(hoy), materiaId, profesorId }
}

/**
 * Copia de `params` con los filtros dados (sin mutar los actuales): un filtro vacío no se escribe,
 * el mes en curso tampoco (es el valor por defecto) y los demás parámetros (`tab`, `detalle`,
 * `fecha`) se conservan.
 */
export function paramsConFiltros(
  params: URLSearchParams,
  filtros: FiltrosHistorial,
  hoy: string,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete('mes')
  nuevos.delete('desde')
  nuevos.delete('hasta')
  if (filtros.periodo.opcion === 'rango') {
    nuevos.set('desde', filtros.periodo.desde)
    nuevos.set('hasta', filtros.periodo.hasta)
  } else if (filtros.periodo.mes !== mesDe(hoy)) {
    nuevos.set('mes', filtros.periodo.mes)
  }
  if (filtros.materiaId !== null) nuevos.set('materiaId', String(filtros.materiaId))
  else nuevos.delete('materiaId')
  if (filtros.profesorId !== null) nuevos.set('profesorId', String(filtros.profesorId))
  else nuevos.delete('profesorId')
  return nuevos
}

/** "Limpiar filtros": vuelve al mes en curso y saca materia y profesor; lo demás se conserva. */
export function paramsSinFiltros(params: URLSearchParams, hoy: string): URLSearchParams {
  return paramsConFiltros(
    params,
    { periodo: periodoPorDefecto(hoy), materiaId: null, profesorId: null },
    hoy,
  )
}

/** Si hay algo que limpiar: un período que no es el mes en curso, o una materia o un profesor. */
export function hayFiltros(filtros: FiltrosHistorial, hoy: string): boolean {
  if (filtros.materiaId !== null || filtros.profesorId !== null) return true
  return filtros.periodo.opcion !== 'mes' || filtros.periodo.mes !== mesDe(hoy)
}

/** Los filtros como van al query de la API: el período siempre, los vacíos no se mandan. */
export function aParams(filtros: FiltrosHistorial): HistorialParams {
  return {
    desde: filtros.periodo.desde,
    hasta: filtros.periodo.hasta,
    ...(filtros.materiaId !== null && { materiaId: filtros.materiaId }),
    ...(filtros.profesorId !== null && { profesorId: filtros.profesorId }),
  }
}
