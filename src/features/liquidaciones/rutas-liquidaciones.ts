// La URL del PDF de una liquidación (docs/arquitectura-frontend.md → Documentos PDF): un enlace,
// no un pedido. Sirve para las dos vistas: la API deja al profesor bajar solo la suya.

/** `/api/v1/liquidaciones/profesores/{profesorId}/{mes}/pdf`. */
export function hrefPdfLiquidacion({ profesorId, mes }: { profesorId: number; mes: string }) {
  return `/api/v1/liquidaciones/profesores/${profesorId}/${mes}/pdf`
}

/**
 * `/api/v1/liquidaciones/mis-liquidaciones/{mes}/pdf`: el PDF de la liquidación del profesor de la
 * sesión, que no conoce su `profesorId` (los `mis-…` lo toman de la sesión, T-126). La ruta la suma
 * T-125 en la API; hasta entonces el enlace responde 404.
 */
export function hrefPdfMiLiquidacion(mes: string) {
  return `/api/v1/liquidaciones/mis-liquidaciones/${mes}/pdf`
}
