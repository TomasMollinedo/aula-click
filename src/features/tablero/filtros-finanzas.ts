import {
  DIRECCIONES_ORDEN,
  ORDENES_FINANZAS,
  type DireccionOrden,
  type OrdenFinanzas,
  type ParamsFinanzas,
  type PeriodoTablero,
} from './tablero.types'

// El estado de la tabla por profesor de la sección "Finanzas" en la URL (HU-47): su página y su
// orden. Funciones puras: este es el único lugar que conoce esos nombres de parámetros. Qué filas
// trae cada página y cómo se ordenan lo decide la API: acá un valor que no existe cae en el por
// defecto, para que la URL nunca rompa la pantalla. La evolución no pagina ni se reordena, así que
// no tiene estado.
//
// URL: `?page=2&orden=parteCentro&direccion=asc`. Los valores por defecto no se escriben.

export type FiltrosFinanzas = {
  page: number
  orden: OrdenFinanzas
  direccion: DireccionOrden
}

/** Los mismos que toma la API cuando no se le manda nada. */
export const FILTROS_FINANZAS_POR_DEFECTO: FiltrosFinanzas = {
  page: 1,
  orden: 'totalCobrado',
  direccion: 'desc',
}

/** Un entero >= 1, o `null` si no viene o no es válido. */
function pagina(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null
}

function esOrden(valor: string | null): valor is OrdenFinanzas {
  return valor !== null && (ORDENES_FINANZAS as readonly string[]).includes(valor)
}

function esDireccion(valor: string | null): valor is DireccionOrden {
  return valor !== null && (DIRECCIONES_ORDEN as readonly string[]).includes(valor)
}

/** El estado de la tabla que dice la URL. */
export function leerFiltrosFinanzas(params: URLSearchParams): FiltrosFinanzas {
  const orden = params.get('orden')
  const direccion = params.get('direccion')
  return {
    page: pagina(params.get('page')) ?? FILTROS_FINANZAS_POR_DEFECTO.page,
    orden: esOrden(orden) ? orden : FILTROS_FINANZAS_POR_DEFECTO.orden,
    direccion: esDireccion(direccion) ? direccion : FILTROS_FINANZAS_POR_DEFECTO.direccion,
  }
}

/**
 * Copia de `actuales` con el estado de la tabla (sin mutar los actuales): un valor por defecto no
 * se escribe y los demás parámetros (la sección y el período) se conservan.
 */
export function paramsConFiltrosFinanzas(
  actuales: URLSearchParams,
  filtros: FiltrosFinanzas,
): URLSearchParams {
  const params = new URLSearchParams(actuales)
  const escribir = (nombre: string, valor: string, porDefecto: boolean) => {
    if (porDefecto) params.delete(nombre)
    else params.set(nombre, valor)
  }
  escribir('page', String(filtros.page), filtros.page === FILTROS_FINANZAS_POR_DEFECTO.page)
  escribir('orden', filtros.orden, filtros.orden === FILTROS_FINANZAS_POR_DEFECTO.orden)
  escribir(
    'direccion',
    filtros.direccion,
    filtros.direccion === FILTROS_FINANZAS_POR_DEFECTO.direccion,
  )
  return params
}

/**
 * Los filtros después de clickear el encabezado de `columna`: si ya se ordena por ella, invierte la
 * dirección; si no, ordena por ella en la dirección con la que se lee más naturalmente (el nombre
 * del profesor, de la A a la Z; los números, de mayor a menor). Vuelve a la primera página, como
 * cualquier cambio de orden.
 */
export function filtrosFinanzasConOrden(
  filtros: FiltrosFinanzas,
  columna: OrdenFinanzas,
): FiltrosFinanzas {
  const direccion: DireccionOrden =
    filtros.orden === columna
      ? filtros.direccion === 'asc'
        ? 'desc'
        : 'asc'
      : columna === 'profesor'
        ? 'asc'
        : 'desc'
  return { orden: columna, direccion, page: 1 }
}

/** El query de `GET /tablero/finanzas`: el período que se ve más el estado de la tabla. */
export function aParamsFinanzas(periodo: PeriodoTablero, filtros: FiltrosFinanzas): ParamsFinanzas {
  return { ...periodo, ...filtros }
}
