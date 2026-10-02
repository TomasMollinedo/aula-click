import type { PeriodoTablero } from './tablero.types'

// La URL del documento PDF del tablero que arma la API (docs/contrato-api.md → Documentos PDF). Es
// un enlace (`<a target="_blank">`), no un pedido con `fetchJson`: el navegador abre el PDF en su
// visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arma.

/**
 * `/api/v1/tablero/pdf?desde=…&hasta=…`: el tablero del período que se está viendo. La API decide
 * todo lo demás (los indicadores salen del mismo cálculo que la pantalla).
 */
export function hrefPdfTablero({ desde, hasta }: PeriodoTablero): string {
  return `/api/v1/tablero/pdf?${new URLSearchParams({ desde, hasta })}`
}
