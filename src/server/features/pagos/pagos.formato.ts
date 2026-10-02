import { fechaHoraDocumento } from '@/server/shared/formato'

// Textos del comprobante de pago en PDF (HU-15). Devuelven lo mismo que los del frontend
// (`src/features/pagos/formato-pagos.ts`), que el backend no puede importar.

/** `'N° 1024'`: el número solo, junto al título del comprobante. */
export function textoNumero(numeroComprobante: number): string {
  return `N° ${numeroComprobante}`
}

/**
 * Quién cargó el pago y cuándo, en el pie del comprobante: `'Registrado por Ana Pérez el
 * 05/10/2026 11:30'`. El instante es ISO 8601 (UTC) y se muestra en la hora del negocio.
 */
export function textoRegistradoPor(
  usuario: { nombre: string; apellido: string },
  instante: string,
): string {
  const cuando = fechaHoraDocumento(new Date(instante))
  return `Registrado por ${usuario.nombre} ${usuario.apellido} el ${cuando}`
}

/** Nombre del archivo del PDF, sin extensión: `'comprobante-1024'` (solo el número). */
export function nombreArchivoComprobante(numeroComprobante: number): string {
  return `comprobante-${numeroComprobante}`
}
