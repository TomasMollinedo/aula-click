import { endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns'

import type { CodigoFormaPago } from './pago-detalle.types'
import type { ListarPagosRealizadosParams } from './pagos-realizados.types'

// Los filtros de "Pagos realizados" (HU-36) en la URL. Funciones puras: este es el único lugar que
// conoce los nombres de los parámetros y sus valores válidos. Ninguna función usa `new Date()`:
// "hoy" se recibe, y solo sirve para proponer el mes en curso (docs/arquitectura-frontend.md →
// Fechas y horas).
//
// - Ficha del alumno: `?tab=pagos&vista=realizados&desde=&hasta=&materiaId=&profesorId=&formaPago=&page=`.
//   El alumno es el de la ficha: un `alumnoId` de la URL no se lee.
// - Vista global (`/mesa/pagos?vista=realizados`, `/gerente/pagos`): además, `alumnoId`.
// - Sin `desde` y `hasta` (o con uno solo, o alguno inválido), el período es el mes en curso, que
//   tampoco se escribe. A la API se mandan siempre los dos: son obligatorios.
// - Los demás parámetros (`tab`, `vista`, `pago`) se conservan; cambiar un filtro vuelve a la
//   página 1.
//
// El período no se revalida: un `hasta` anterior al `desde` se manda y lo rechaza la API con un
// 400 sobre `hasta`, que se muestra junto al campo.

/** Las formas de pago, por su código, en el orden en que se muestran. */
export const FORMAS_PAGO = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEBITO',
] as const satisfies readonly CodigoFormaPago[]

export type FiltrosPagosRealizados = {
  desde: string
  hasta: string
  /** Solo en la vista global; en la ficha siempre `null`. */
  alumnoId: number | null
  materiaId: number | null
  profesorId: number | null
  formaPago: CodigoFormaPago | null
}

/** Si la pantalla filtra por alumno: la vista global sí, la ficha (que ya es de un alumno) no. */
export type OpcionesFiltros = { conAlumno: boolean }

const FORMATO_FECHA = 'yyyy-MM-dd'
const PARAMETROS = ['desde', 'hasta', 'alumnoId', 'materiaId', 'profesorId', 'formaPago'] as const

/** El primer y el último día del mes de `hoy`: el período por defecto. */
export function mesEnCurso(hoy: string): { desde: string; hasta: string } {
  const fecha = parseISO(hoy)
  return {
    desde: format(startOfMonth(fecha), FORMATO_FECHA),
    hasta: format(endOfMonth(fecha), FORMATO_FECHA),
  }
}

/** Una fecha real `YYYY-MM-DD` (`2026-02-30` y `30/09/2026` no lo son), o `null`. */
function fechaReal(valor: string | null): string | null {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const fecha = parseISO(valor)
  return isValid(fecha) && format(fecha, FORMATO_FECHA) === valor ? valor : null
}

/** Un entero >= 1, o `null` si no viene o no es válido. */
function enteroPositivo(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null
}

function formaPago(valor: string | null): CodigoFormaPago | null {
  return FORMAS_PAGO.find((codigo) => codigo === valor) ?? null
}

/** Sin filtros: el mes en curso y nada más. Es lo que deja "Limpiar filtros". */
export function filtrosPorDefecto(hoy: string): FiltrosPagosRealizados {
  return {
    ...mesEnCurso(hoy),
    alumnoId: null,
    materiaId: null,
    profesorId: null,
    formaPago: null,
  }
}

/**
 * Los filtros de la URL. Un valor inválido es "sin filtro": la URL nunca rompe la pantalla. El
 * período necesita las **dos** fechas válidas; si no, es el mes en curso.
 */
export function leerFiltros(
  params: URLSearchParams,
  hoy: string,
  { conAlumno }: OpcionesFiltros,
): FiltrosPagosRealizados {
  const desde = fechaReal(params.get('desde'))
  const hasta = fechaReal(params.get('hasta'))
  return {
    ...(desde !== null && hasta !== null ? { desde, hasta } : mesEnCurso(hoy)),
    alumnoId: conAlumno ? enteroPositivo(params.get('alumnoId')) : null,
    materiaId: enteroPositivo(params.get('materiaId')),
    profesorId: enteroPositivo(params.get('profesorId')),
    formaPago: formaPago(params.get('formaPago')),
  }
}

/** La página de la tabla; una que no sea un entero >= 1 se toma como 1. */
export function leerPagina(params: URLSearchParams): number {
  return enteroPositivo(params.get('page')) ?? 1
}

function esMesEnCurso(filtros: Pick<FiltrosPagosRealizados, 'desde' | 'hasta'>, hoy: string) {
  const mes = mesEnCurso(hoy)
  return filtros.desde === mes.desde && filtros.hasta === mes.hasta
}

/**
 * Copia de `params` con los filtros dados (sin mutar los actuales): un filtro vacío no se escribe,
 * el mes en curso tampoco (es el valor por defecto; cualquier otro período se escribe con sus dos
 * fechas), los demás parámetros (`tab`, `vista`, `pago`) se conservan y la página se descarta,
 * porque cambiar un filtro vuelve a la 1.
 */
export function paramsConFiltros(
  params: URLSearchParams,
  filtros: FiltrosPagosRealizados,
  hoy: string,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete('page')
  for (const nombre of PARAMETROS) nuevos.delete(nombre)
  if (!esMesEnCurso(filtros, hoy)) {
    nuevos.set('desde', filtros.desde)
    nuevos.set('hasta', filtros.hasta)
  }
  const { alumnoId, materiaId, profesorId, formaPago: forma } = filtros
  if (alumnoId !== null) nuevos.set('alumnoId', String(alumnoId))
  if (materiaId !== null) nuevos.set('materiaId', String(materiaId))
  if (profesorId !== null) nuevos.set('profesorId', String(profesorId))
  if (forma !== null) nuevos.set('formaPago', forma)
  return nuevos
}

/** Copia de `params` con otra página (la 1 no se escribe); lo demás no cambia. */
export function paramsConPagina(params: URLSearchParams, page: number): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (page > 1) nuevos.set('page', String(page))
  else nuevos.delete('page')
  return nuevos
}

/** "Limpiar filtros": vuelve al mes en curso y saca el resto; lo demás se conserva. */
export function paramsSinFiltros(params: URLSearchParams, hoy: string): URLSearchParams {
  return paramsConFiltros(params, filtrosPorDefecto(hoy), hoy)
}

/** Si hay algo que limpiar: un período que no es el mes en curso, o cualquier otro filtro. */
export function hayFiltros(filtros: FiltrosPagosRealizados, hoy: string): boolean {
  return (
    !esMesEnCurso(filtros, hoy) ||
    filtros.alumnoId !== null ||
    filtros.materiaId !== null ||
    filtros.profesorId !== null ||
    filtros.formaPago !== null
  )
}

/** Si el total depende de la materia o del profesor: suma el pago completo (decisión T-152). */
export function filtraPorTurno(filtros: FiltrosPagosRealizados): boolean {
  return filtros.materiaId !== null || filtros.profesorId !== null
}

/**
 * El alumno que acota los buscadores de profesor y materia (decisión T-170): el de la ficha
 * (`alumnoIdFicha`) o, en la vista global, el elegido en el filtro. Sin alumno, `undefined`: los
 * buscadores ofrecen todos los que aparecen en algún pago.
 */
export function alumnoDeLosBuscadores(
  filtros: Pick<FiltrosPagosRealizados, 'alumnoId'>,
  alumnoIdFicha?: number,
): number | undefined {
  return alumnoIdFicha ?? filtros.alumnoId ?? undefined
}

/**
 * El query de `GET /pagos`: el período siempre, los vacíos no se mandan. En la ficha, el alumno es
 * `alumnoIdFicha` (el de la prop), nunca uno de la URL.
 */
export function aParams(
  filtros: FiltrosPagosRealizados,
  page: number,
  alumnoIdFicha?: number,
): ListarPagosRealizadosParams {
  const alumnoId = alumnoIdFicha ?? filtros.alumnoId
  return {
    desde: filtros.desde,
    hasta: filtros.hasta,
    ...(alumnoId !== null && { alumnoId }),
    ...(filtros.materiaId !== null && { materiaId: filtros.materiaId }),
    ...(filtros.profesorId !== null && { profesorId: filtros.profesorId }),
    ...(filtros.formaPago !== null && { formaPago: filtros.formaPago }),
    page,
  }
}
