// El detalle de un pago se abre con `?pago=<pagoId>` sobre la pantalla que lo muestra (la ficha del
// alumno, la vista global de pagos, "Pagos" del gerente y el detalle de un turno pagado). Funciones
// puras: este es el único lugar que conoce el nombre de ese parámetro.

const PARAM_PAGO = 'pago'

/** El pago pedido en la URL, o `null` si falta o no es un id válido. */
export function leerPagoId(params: URLSearchParams): number | null {
  const valor = params.get(PARAM_PAGO)
  if (valor === null || !/^\d+$/.test(valor)) return null
  const pagoId = Number(valor)
  return Number.isSafeInteger(pagoId) && pagoId > 0 ? pagoId : null
}

/** Copia de `params` con el pago a abrir; los demás parámetros (tab, vista, filtros…) se conservan. */
export function paramsConPago(params: URLSearchParams, pagoId: number): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.set(PARAM_PAGO, String(pagoId))
  return nuevos
}

/** Copia de `params` sin el pago; los demás parámetros se conservan. */
export function paramsSinPago(params: URLSearchParams): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete(PARAM_PAGO)
  return nuevos
}
