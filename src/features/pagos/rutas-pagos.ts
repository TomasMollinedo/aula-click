// URL del comprobante de un pago: el PDF que arma la API (`GET /api/v1/pagos/{id}/pdf`,
// docs/contrato-api.md → Pagos). Es un enlace (`<a target="_blank">`), no un pedido con
// `fetchJson`: el navegador lo abre en su visor, en otra pestaña, y desde ahí se descarga.
// Registrar y consultar pagos es solo de mesa de entradas (la API responde 403 a cualquier otro
// rol).

/** `/api/v1/pagos/31/pdf`: con el id del pago (`pagoId`), no con el número de comprobante. */
export function hrefComprobante(pagoId: number): string {
  return `/api/v1/pagos/${pagoId}/pdf`
}
