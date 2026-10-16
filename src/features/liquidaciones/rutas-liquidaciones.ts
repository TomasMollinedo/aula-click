// La URL del PDF de una liquidación (docs/arquitectura-frontend.md → Documentos PDF): un enlace,
// no un pedido. Sirve para las dos vistas: la API deja al profesor bajar solo la suya.

/** `/api/v1/liquidaciones/profesores/{profesorId}/{mes}/pdf`. */
export function hrefPdfLiquidacion({ profesorId, mes }: { profesorId: number; mes: string }) {
  return `/api/v1/liquidaciones/profesores/${profesorId}/${mes}/pdf`
}
