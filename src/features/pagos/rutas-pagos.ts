// URL del comprobante de un pago. Registrar y consultar pagos es solo de mesa de entradas (la API
// responde 403 a cualquier otro rol), así que el segmento es fijo: no hay otro rol que reuse estos
// componentes con su propia `rutaBase`. La ruta vive en `app/(documentos)/mesa/`, sin el layout del
// segmento (docs/arquitectura-frontend.md → Documentos imprimibles).

/** `/mesa/pagos/31/comprobante`: con el id del pago (`pagoId`), no con el número de comprobante. */
export function hrefComprobante(pagoId: number): string {
  return `/mesa/pagos/${pagoId}/comprobante`
}
