import {
  DIRECCIONES_ORDEN,
  ORDENES_PROFESORES,
  type DireccionOrden,
  type OrdenProfesores,
  type ParamsAsistencia,
  type PeriodoTablero,
} from './tablero.types'

// El estado de las dos tablas de la sección "Asistencia" en la URL (HU-39): la página de cada una,
// el orden de la de profesores y el filtro "Sólo con turnos sin registrar". Funciones puras: este
// es el único lugar que conoce esos nombres de parámetros. Qué filas trae cada página, cómo se
// ordenan y si un valor es válido lo decide la API: acá un valor que no existe es "sin filtro" y
// cae en el por defecto, para que la URL nunca rompa la pantalla.
//
// URL: `?paginaProfesores=2&paginaMaterias=3&orden=asistenciasRegistradas&direccion=asc&soloSinRegistrar=true`.
// Los valores por defecto no se escriben.

export type FiltrosAsistencia = {
  paginaProfesores: number
  paginaMaterias: number
  orden: OrdenProfesores
  direccion: DireccionOrden
  soloSinRegistrar: boolean
}

/** Los mismos que toma la API cuando no se le manda nada. */
export const FILTROS_POR_DEFECTO: FiltrosAsistencia = {
  paginaProfesores: 1,
  paginaMaterias: 1,
  orden: 'cerradosSinRegistrar',
  direccion: 'desc',
  soloSinRegistrar: false,
}

/** Un entero >= 1, o `null` si no viene o no es válido. */
function pagina(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null
}

function esOrden(valor: string | null): valor is OrdenProfesores {
  return valor !== null && (ORDENES_PROFESORES as readonly string[]).includes(valor)
}

function esDireccion(valor: string | null): valor is DireccionOrden {
  return valor !== null && (DIRECCIONES_ORDEN as readonly string[]).includes(valor)
}

/** El estado de las tablas que dice la URL. */
export function leerFiltrosAsistencia(params: URLSearchParams): FiltrosAsistencia {
  const orden = params.get('orden')
  const direccion = params.get('direccion')
  return {
    paginaProfesores:
      pagina(params.get('paginaProfesores')) ?? FILTROS_POR_DEFECTO.paginaProfesores,
    paginaMaterias: pagina(params.get('paginaMaterias')) ?? FILTROS_POR_DEFECTO.paginaMaterias,
    orden: esOrden(orden) ? orden : FILTROS_POR_DEFECTO.orden,
    direccion: esDireccion(direccion) ? direccion : FILTROS_POR_DEFECTO.direccion,
    soloSinRegistrar: params.get('soloSinRegistrar') === 'true',
  }
}

/**
 * Copia de `actuales` con el estado de las tablas (sin mutar los actuales): un valor por defecto no
 * se escribe y los demás parámetros (la sección y el período) se conservan.
 */
export function paramsConFiltrosAsistencia(
  actuales: URLSearchParams,
  filtros: FiltrosAsistencia,
): URLSearchParams {
  const params = new URLSearchParams(actuales)
  const escribir = (nombre: string, valor: string, porDefecto: boolean) => {
    if (porDefecto) params.delete(nombre)
    else params.set(nombre, valor)
  }
  escribir(
    'paginaProfesores',
    String(filtros.paginaProfesores),
    filtros.paginaProfesores === FILTROS_POR_DEFECTO.paginaProfesores,
  )
  escribir(
    'paginaMaterias',
    String(filtros.paginaMaterias),
    filtros.paginaMaterias === FILTROS_POR_DEFECTO.paginaMaterias,
  )
  escribir('orden', filtros.orden, filtros.orden === FILTROS_POR_DEFECTO.orden)
  escribir('direccion', filtros.direccion, filtros.direccion === FILTROS_POR_DEFECTO.direccion)
  escribir('soloSinRegistrar', 'true', !filtros.soloSinRegistrar)
  return params
}

/**
 * Los filtros después de clickear el encabezado de `columna`: si ya se ordena por ella, invierte la
 * dirección; si no, ordena por ella en la dirección con la que se lee más naturalmente (el nombre
 * del profesor, de la A a la Z; los números, de mayor a menor). Vuelve a la primera página de la
 * tabla de profesores, como cualquier cambio de orden; la de materias no se mueve.
 */
export function filtrosConOrden(
  filtros: FiltrosAsistencia,
  columna: OrdenProfesores,
): FiltrosAsistencia {
  const direccion: DireccionOrden =
    filtros.orden === columna
      ? filtros.direccion === 'asc'
        ? 'desc'
        : 'asc'
      : columna === 'profesor'
        ? 'asc'
        : 'desc'
  return { ...filtros, orden: columna, direccion, paginaProfesores: 1 }
}

/** El query de `GET /tablero/asistencia`: el período que se ve más el estado de las tablas. */
export function aParamsAsistencia(
  periodo: PeriodoTablero,
  filtros: FiltrosAsistencia,
): ParamsAsistencia {
  return { ...periodo, ...filtros }
}
