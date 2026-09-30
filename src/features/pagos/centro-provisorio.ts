// TEMPORAL (T-52): datos del centro de prueba para ver e imprimir el comprobante mientras no existe
// `GET /api/v1/centro` (T-64). `ComprobantePago` los usa solo si ese endpoint responde 404. Se
// borra, junto con su uso en `ComprobantePago.tsx`, cuando T-64 esté mergeada (issue #129). No son
// los datos reales del centro: los pasan las PO (definición G) y los sirve la API.

/** Misma forma que `centro` de `DocumentoOficial` (y que `GET /centro`). */
export const CENTRO_PROVISORIO: { nombre: string; direccion: string; telefono: string } = {
  nombre: 'Centro de prueba (datos provisorios hasta T-64)',
  direccion: 'Dirección de prueba 123, Salta',
  telefono: '387 000-0000',
}
