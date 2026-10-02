import { isValid, parseISO } from 'date-fns'

import type { FiltrosCuentaParams, ListarGlobalParams } from './cuentas.types'

// Los filtros de `cuentas` en la URL. Funciones puras: este es el único lugar que conoce los
// nombres de los parámetros y sus valores válidos.
//
// - Ficha del alumno: `?tab=pagos&desde=&hasta=&materiaId=&profesorId=`. El `tab` es de
//   `AlumnoDetalle`, que al cambiar de pestaña arma la URL de cero: los filtros se van solos.
// - Vista global: `?alumnoId=&desde=&hasta=&materiaId=&profesorId=&pageAdeudados=&pageProximos=`.
//
// Qué parte del período le toca a cada sección lo decide la API (dominio → Deuda): acá no se
// compara nada contra hoy, y un `hasta` anterior a `desde` no se corrige (lo rechaza la API).

/** Período, materia y profesor: los filtros de las dos vistas. `null` = sin ese filtro. */
export type FiltrosCuenta = {
  desde: string | null
  hasta: string | null
  materiaId: number | null
  profesorId: number | null
}

/** Los de la vista global: además, el alumno. */
export type FiltrosGlobal = FiltrosCuenta & { alumnoId: number | null }

/** Cada tabla de la vista global tiene su página. */
export type SeccionDeCuenta = 'adeudados' | 'proximos'
export type PaginasGlobal = Record<SeccionDeCuenta, number>

export const FILTROS_VACIOS: FiltrosGlobal = {
  alumnoId: null,
  desde: null,
  hasta: null,
  materiaId: null,
  profesorId: null,
}

const PARAMETRO_PAGINA: Record<SeccionDeCuenta, string> = {
  adeudados: 'pageAdeudados',
  proximos: 'pageProximos',
}

/** Un entero >= 1, o `null` si no viene o no es válido. */
function enteroPositivo(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null
}

/** Una fecha real `YYYY-MM-DD`, o `null` (`2026-02-30` y `30/09/2026` no lo son). */
function fecha(valor: string | null): string | null {
  return valor !== null && /^\d{4}-\d{2}-\d{2}$/.test(valor) && isValid(parseISO(valor))
    ? valor
    : null
}

/** Un valor inválido (o ausente) es "sin filtro": la URL nunca rompe la pantalla. */
export function leerFiltros(params: URLSearchParams): FiltrosGlobal {
  return {
    alumnoId: enteroPositivo(params.get('alumnoId')),
    desde: fecha(params.get('desde')),
    hasta: fecha(params.get('hasta')),
    materiaId: enteroPositivo(params.get('materiaId')),
    profesorId: enteroPositivo(params.get('profesorId')),
  }
}

/** La página de cada tabla; una que no sea un entero >= 1 se toma como 1. */
export function leerPaginas(params: URLSearchParams): PaginasGlobal {
  return {
    adeudados: enteroPositivo(params.get(PARAMETRO_PAGINA.adeudados)) ?? 1,
    proximos: enteroPositivo(params.get(PARAMETRO_PAGINA.proximos)) ?? 1,
  }
}

function sinPaginas(params: URLSearchParams): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete(PARAMETRO_PAGINA.adeudados)
  nuevos.delete(PARAMETRO_PAGINA.proximos)
  return nuevos
}

/**
 * Copia de `params` con los filtros dados: un filtro vacío no se escribe, los demás parámetros
 * (`tab`) se conservan y las dos páginas se descartan, porque cambiar un filtro vuelve a la 1.
 */
export function paramsConFiltros(params: URLSearchParams, filtros: FiltrosGlobal): URLSearchParams {
  const nuevos = sinPaginas(params)
  for (const [nombre, valor] of Object.entries(filtros)) {
    if (valor === null) nuevos.delete(nombre)
    else nuevos.set(nombre, String(valor))
  }
  return nuevos
}

/** Copia de `params` con esa tabla en esa página (la 1 no se escribe); lo demás no cambia. */
export function paramsConPagina(
  params: URLSearchParams,
  seccion: SeccionDeCuenta,
  page: number,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (page > 1) nuevos.set(PARAMETRO_PAGINA[seccion], String(page))
  else nuevos.delete(PARAMETRO_PAGINA[seccion])
  return nuevos
}

/** "Limpiar filtros": sin filtros ni páginas; los demás parámetros (`tab`) se conservan. */
export function paramsSinFiltros(params: URLSearchParams): URLSearchParams {
  return paramsConFiltros(params, FILTROS_VACIOS)
}

/** Con `desde` o `hasta`: el total pasa a ser "del período". */
export function hayPeriodo(filtros: Pick<FiltrosCuenta, 'desde' | 'hasta'>): boolean {
  return filtros.desde !== null || filtros.hasta !== null
}

/** Si hay algo que limpiar. En la ficha se le pasan los filtros sin `alumnoId`. */
export function hayFiltros(filtros: Partial<FiltrosGlobal>): boolean {
  return Object.values(filtros).some((valor) => valor != null)
}

/** Los filtros como van al query de la API: sin los vacíos. */
export function aParams(filtros: FiltrosCuenta): FiltrosCuentaParams {
  return {
    ...(filtros.desde !== null && { desde: filtros.desde }),
    ...(filtros.hasta !== null && { hasta: filtros.hasta }),
    ...(filtros.materiaId !== null && { materiaId: filtros.materiaId }),
    ...(filtros.profesorId !== null && { profesorId: filtros.profesorId }),
  }
}

/** El query de una tabla de la vista global: los filtros, el alumno y su página. */
export function aParamsGlobal(filtros: FiltrosGlobal, page: number): ListarGlobalParams {
  return {
    ...aParams(filtros),
    ...(filtros.alumnoId !== null && { alumnoId: filtros.alumnoId }),
    page,
  }
}

/**
 * Identidad de los filtros (sin las páginas): la selección de la vista global es de un filtro y se
 * vacía cuando esta clave cambia.
 */
export function claveDeFiltros(filtros: FiltrosGlobal): string {
  return paramsConFiltros(new URLSearchParams(), filtros).toString()
}
