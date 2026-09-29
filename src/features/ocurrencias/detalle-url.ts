// El detalle de una ocurrencia se abre con `?detalle=<turnoId>&fecha=<fechaOriginal>` sobre la
// pantalla que lo muestra (agenda, ficha del alumno, alta de turno). Funciones puras: este es el
// único lugar que conoce los nombres de esos parámetros.
//
// OJO: en las agendas `fecha` también es el día o la semana que se está viendo (`?fecha=`), así que
// abrir el detalle de una ocurrencia reprogramada (fecha original distinta de la vista) mueve la
// vista. Si eso molesta, se resuelve cambiando `PARAM_FECHA` acá (y en T-58/T-60 que lo nombran).

const PARAM_DETALLE = 'detalle'
const PARAM_FECHA = 'fecha'
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export type DetalleEnUrl = { turnoId: number; fecha: string }

/** El detalle pedido en la URL, o `null` si falta alguno de los dos parámetros o son inválidos. */
export function leerDetalle(params: URLSearchParams): DetalleEnUrl | null {
  const idParam = params.get(PARAM_DETALLE)
  const fecha = params.get(PARAM_FECHA)
  if (idParam === null || fecha === null || !FECHA_VALIDA.test(fecha)) return null
  const turnoId = Number(idParam)
  return Number.isInteger(turnoId) && turnoId > 0 ? { turnoId, fecha } : null
}

/** Copia de `params` con el detalle a abrir; los demás parámetros (tab, filtros…) se conservan. */
export function paramsConDetalle(params: URLSearchParams, detalle: DetalleEnUrl): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.set(PARAM_DETALLE, String(detalle.turnoId))
  nuevos.set(PARAM_FECHA, detalle.fecha)
  return nuevos
}

/**
 * Copia de `params` sin el detalle. `conservarFecha`: la pantalla usa `fecha` para otra cosa (las
 * agendas), así que al cerrar el detalle se deja.
 */
export function paramsSinDetalle(
  params: URLSearchParams,
  { conservarFecha }: { conservarFecha: boolean },
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete(PARAM_DETALLE)
  if (!conservarFecha) nuevos.delete(PARAM_FECHA)
  return nuevos
}
