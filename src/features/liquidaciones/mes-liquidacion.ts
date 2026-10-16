import { sumarDias, sumarMeses } from '@/utils/calendario'

import { ESTADOS_LIQUIDACION, type EstadoLiquidacion } from './liquidaciones.types'

// El mes, el profesor y la página del listado de liquidaciones en la URL. Funciones puras: este es
// el único lugar que conoce los nombres de los parámetros. Sin `?mes=` (o con uno que no sea `AAAA-MM`
// válido) no se manda mes y la API devuelve el último terminado; un mes futuro se manda igual y lo
// rechaza la API.

const PARAMETRO_MES = 'mes'
const PARAMETRO_PROFESOR = 'profesorId'
const PARAMETRO_ESTADO = 'estado'
const PARAMETRO_PAGINA = 'page'

/** Lo que se pide a la API. */
export type MesLiquidacion = {
  /** `YYYY-MM`, o sin mes. */
  mes: string | undefined
  /** El filtro por profesor; sin él, las liquidaciones de todos. */
  profesorId: number | undefined
  /** El filtro por estado; sin él, todas. */
  estado: EstadoLiquidacion | undefined
  page: number
}

function mesValido(valor: string | null): string | undefined {
  return valor !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : undefined
}

function estadoValido(valor: string | null): EstadoLiquidacion | undefined {
  return ESTADOS_LIQUIDACION.find((estado) => estado === valor)
}

/**
 * El mes, los filtros y la página de la URL; una `page` que no sea un entero >= 1 es la 1, un
 * `profesorId` que no sea un entero >= 1 es sin filtro y un `estado` desconocido también.
 */
export function leerMesLiquidacion(params: URLSearchParams): MesLiquidacion {
  const page = Number(params.get(PARAMETRO_PAGINA))
  const profesorId = Number(params.get(PARAMETRO_PROFESOR))
  return {
    mes: mesValido(params.get(PARAMETRO_MES)),
    profesorId:
      params.get(PARAMETRO_PROFESOR) !== null && Number.isInteger(profesorId) && profesorId >= 1
        ? profesorId
        : undefined,
    estado: estadoValido(params.get(PARAMETRO_ESTADO)),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** Copia de `params` con ese mes: los demás parámetros se conservan y la página vuelve a la 1. */
export function paramsConMes(params: URLSearchParams, mes: string): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.set(PARAMETRO_MES, mes)
  nuevos.delete(PARAMETRO_PAGINA)
  return nuevos
}

/** Copia de `params` con ese profesor (`null` saca el filtro): la página vuelve a la 1. */
export function paramsConProfesor(
  params: URLSearchParams,
  profesorId: number | null,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (profesorId === null) nuevos.delete(PARAMETRO_PROFESOR)
  else nuevos.set(PARAMETRO_PROFESOR, String(profesorId))
  nuevos.delete(PARAMETRO_PAGINA)
  return nuevos
}

/** Copia de `params` con ese estado (`null` saca el filtro): la página vuelve a la 1. */
export function paramsConEstado(
  params: URLSearchParams,
  estado: EstadoLiquidacion | null,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (estado === null) nuevos.delete(PARAMETRO_ESTADO)
  else nuevos.set(PARAMETRO_ESTADO, estado)
  nuevos.delete(PARAMETRO_PAGINA)
  return nuevos
}

/** Copia de `params` sin filtros: sin profesor ni estado y otra vez en el mes en curso (el mes por defecto). */
export function paramsSinFiltros(params: URLSearchParams): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete(PARAMETRO_MES)
  nuevos.delete(PARAMETRO_PROFESOR)
  nuevos.delete(PARAMETRO_ESTADO)
  nuevos.delete(PARAMETRO_PAGINA)
  return nuevos
}

/** Copia de `params` con esa página (la 1 no se escribe); lo demás no cambia. */
export function paramsConPagina(params: URLSearchParams, page: number): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (page > 1) nuevos.set(PARAMETRO_PAGINA, String(page))
  else nuevos.delete(PARAMETRO_PAGINA)
  return nuevos
}

function sumarAlMes(mes: string, meses: number): string {
  return sumarMeses(`${mes}-01`, meses).slice(0, 7)
}

/** `'2026-12'` → `'2027-01'`. */
export function mesSiguiente(mes: string): string {
  return sumarAlMes(mes, 1)
}

/** `'2026-10'` → `'2026-10-31'`: el último día del mes (la transferencia no puede ser anterior). */
export function ultimoDiaDelMes(mes: string): string {
  return sumarDias(`${mesSiguiente(mes)}-01`, -1)
}
