/**
 * Datos institucionales del encabezado de los documentos oficiales imprimibles (HU-11, HU-15).
 * Precargados, sin pantalla para editarlos (HU-11). El isotipo no está acá: `DocumentoOficial`
 * reusa la misma marca de `SidebarLogo` (ícono + `bg-dorado`), no un archivo aparte.
 *
 * VALORES DE EJEMPLO: pedir el nombre, la dirección y el teléfono reales a las PO antes de usar
 * esto en producción.
 */
export const DATOS_CENTRO = {
  nombre: 'Aula Click — Centro de Atención Académica',
  direccion: 'Av. Ejemplo 1234, Salta',
  telefono: '387 400-0000',
} as const
