import { sumarMeses } from '@/utils/calendario'

// El mes y la página del listado de liquidaciones en la URL. Funciones puras: este es el único
// lugar que conoce los nombres de los parámetros. Sin `?mes=` (o con uno que no sea `AAAA-MM`
// válido) no se manda mes y la API devuelve el último terminado; un mes futuro se manda igual y lo
// rechaza la API.

const PARAMETRO_MES = 'mes'
const PARAMETRO_PAGINA = 'page'

/** Lo que se pide a la API. */
export type MesLiquidacion = {
  /** `YYYY-MM`, o sin mes. */
  mes: string | undefined
  page: number
}

function mesValido(valor: string | null): string | undefined {
  return valor !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : undefined
}

/** El mes y la página de la URL; una `page` que no sea un entero >= 1 es la 1. */
export function leerMesLiquidacion(params: URLSearchParams): MesLiquidacion {
  const page = Number(params.get(PARAMETRO_PAGINA))
  return {
    mes: mesValido(params.get(PARAMETRO_MES)),
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

/** `'2026-01'` → `'2025-12'`. */
export function mesAnterior(mes: string): string {
  return sumarAlMes(mes, -1)
}

/** `'2026-12'` → `'2027-01'`. */
export function mesSiguiente(mes: string): string {
  return sumarAlMes(mes, 1)
}
