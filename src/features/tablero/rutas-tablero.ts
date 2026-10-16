import type { Seccion } from './seccion'
import type { PeriodoTablero } from './tablero.types'

// La URL del documento PDF del tablero que arma la API (docs/contrato-api.md → Documentos PDF). Es
// un enlace (`<a target="_blank">`), no un pedido con `fetchJson`: el navegador abre el PDF en su
// visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arma.

/**
 * `/api/v1/tablero/pdf?desde=…&hasta=…&seccion=…`: la sección que se está viendo, del período que
 * se está viendo. La API decide todo lo demás (los números salen del mismo cálculo que la
 * pantalla). `general` es también el valor por defecto del backend, así que un enlace sin
 * `seccion` sigue funcionando.
 */
export function hrefPdfTablero({
  desde,
  hasta,
  seccion,
}: PeriodoTablero & { seccion: Seccion }): string {
  return `/api/v1/tablero/pdf?${new URLSearchParams({ desde, hasta, seccion })}`
}
