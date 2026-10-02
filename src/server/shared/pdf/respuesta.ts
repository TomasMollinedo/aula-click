// Respuesta HTTP de un documento PDF (docs/contrato-api.md → Documentos PDF). Pura: no conoce
// Hono. El controller hace `c.body(cuerpo, 200, headers)`.

import { normalizarBusqueda } from '../busqueda'

/**
 * Nombre de archivo en ASCII: sin tildes, en minúsculas y con guiones en lugar de espacios y
 * símbolos (`'Turnos de Ñandú Pérez'` → `'turnos-de-nandu-perez'`). Sin extensión.
 */
export function nombreArchivoPdf(texto: string): string {
  const nombre = normalizarBusqueda(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return nombre || 'documento'
}

export type RespuestaPdf = { cuerpo: ArrayBuffer; headers: Record<string, string> }

/**
 * Los bytes y los headers de un PDF que el navegador abre en su visor (`inline`) y descarga con
 * un nombre útil. `nombre` va sin extensión y se sanea con `nombreArchivoPdf`. `no-store` porque
 * son datos personales.
 */
export function respuestaPdf(pdf: Buffer, nombre: string): RespuestaPdf {
  const archivo = `${nombreArchivoPdf(nombre)}.pdf`
  // `c.body()` de Hono pide un `ArrayBuffer` puro; el `Buffer` de Node es una vista sobre uno que
  // puede ser compartido.
  const cuerpo = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
  return {
    cuerpo,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${archivo}"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  }
}
