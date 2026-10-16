// La URL del PDF de la caja diaria que arma la API (docs/contrato-api.md → Documentos PDF). Es un
// enlace (`<a target="_blank">`), no un pedido con `fetchJson`: el navegador abre el PDF en su
// visor, en otra pestaña, y desde ahí se descarga. Único lugar donde se arma.

/**
 * `/api/v1/caja/pdf?fecha=2026-10-15`: la caja del día que se está viendo (la `fecha` de la
 * respuesta, no la de la URL). Los filtros de la lista no van: el documento lleva siempre la lista
 * completa y los mismos números del resumen.
 */
export function hrefPdfCaja(fecha: string): string {
  return `/api/v1/caja/pdf?${new URLSearchParams({ fecha })}`
}
