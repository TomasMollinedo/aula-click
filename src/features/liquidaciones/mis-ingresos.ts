// "Mis ingresos" del profesor (HU-45, T-133). Funciones puras: la URL de la pantalla (qué
// liquidación está abierta y la página de "Mis liquidaciones") y los enlaces. Qué clases y qué
// importes se muestran lo decide la API (`GET /liquidaciones/mis-ingresos`).

const PARAMETRO_LIQUIDACION = 'liquidacion'

function mesValido(valor: string | null): string | null {
  return valor !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : null
}

/** El mes de la liquidación abierta (`?liquidacion=AAAA-MM`), o `null` si no hay una abierta. */
export function leerLiquidacionAbierta(params: URLSearchParams): string | null {
  return mesValido(params.get(PARAMETRO_LIQUIDACION))
}

/** Copia de `params` con esa liquidación abierta (o cerrada, con `null`); lo demás no cambia. */
export function paramsConLiquidacion(params: URLSearchParams, mes: string | null): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (mes === null) nuevos.delete(PARAMETRO_LIQUIDACION)
  else nuevos.set(PARAMETRO_LIQUIDACION, mes)
  return nuevos
}

/** "Asistencia" en el día de la clase (`?fecha=`, el parámetro de esa pantalla). */
export function hrefAsistenciaDelDia(hrefAsistencia: string, fecha: string): string {
  return `${hrefAsistencia}?${new URLSearchParams({ fecha }).toString()}`
}

/** Las pestañas de "Mis ingresos", en su orden. */
export const PESTANAS_MIS_INGRESOS = [
  'este-mes',
  'sin-cobrar',
  'sin-asistencia',
  'liquidaciones',
] as const

export type PestanaMisIngresos = (typeof PESTANAS_MIS_INGRESOS)[number]

const PARAMETRO_PESTANA = 'tab'

/** La pestaña de `?tab=`; sin ella (o con una desconocida), "Este mes". */
export function leerPestana(params: URLSearchParams): PestanaMisIngresos {
  const valor = params.get(PARAMETRO_PESTANA)
  return PESTANAS_MIS_INGRESOS.find((p) => p === valor) ?? 'este-mes'
}

/** Copia de `params` con esa pestaña ("Este mes" no se escribe); lo demás no cambia. */
export function paramsConPestana(
  params: URLSearchParams,
  pestana: PestanaMisIngresos,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (pestana === 'este-mes') nuevos.delete(PARAMETRO_PESTANA)
  else nuevos.set(PARAMETRO_PESTANA, pestana)
  return nuevos
}

/** Registros por página en cada pestaña (en "Liquidaciones" pagina la API, con el mismo tamaño). */
export const REGISTROS_POR_PAGINA = 10

/**
 * Los ítems de la página pedida y el total de páginas, para las pestañas que la API manda enteras
 * ("Este mes", "Sin cobrar" y "Sin asistencia"). Una página fuera de rango cae en la última.
 */
export function paginar<T>(
  items: readonly T[],
  page: number,
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / REGISTROS_POR_PAGINA))
  const actual = Math.min(Math.max(1, page), totalPages)
  const desde = (actual - 1) * REGISTROS_POR_PAGINA
  return { items: items.slice(desde, desde + REGISTROS_POR_PAGINA), page: actual, totalPages }
}

/** "Mostrando 1–10 de 23 clases", como el pie de los otros listados paginados. */
export function textoMostrando(
  page: number,
  total: number,
  nombres: { singular: string; plural: string },
): string {
  const desde = (page - 1) * REGISTROS_POR_PAGINA + 1
  const hasta = Math.min(page * REGISTROS_POR_PAGINA, total)
  return `Mostrando ${desde}–${hasta} de ${total} ${total === 1 ? nombres.singular : nombres.plural}`
}
