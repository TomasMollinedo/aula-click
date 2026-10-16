import type { MensajesCampoArchivo } from '@/components/ui/campo-archivo'
import { ApiError } from '@/utils/fetch-json'

// El comprobante adjunto de un pago (HU-24, docs/contrato-api.md → Adjuntos): el archivo que trae
// la familia. Lo que se acepta es una ayuda para elegir: la API valida tipo, firma y tamaño igual.

/** Tipos que se aceptan, con su etiqueta para la ayuda del campo. */
export const TIPOS_ADJUNTO = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
} as const

/** 5 MB, como la API. */
export const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024

/** Los mensajes de HU-24, los mismos que manda la API en `["archivo"]`. */
export const MENSAJES_ADJUNTO: MensajesCampoArchivo = {
  tipo: 'El archivo debe ser JPG, PNG o PDF',
  tamano: 'El archivo supera los 5 MB',
}

/** Si el adjunto es una imagen (miniatura) o un PDF (ícono). */
export function esImagenAdjunta(tipo: string): boolean {
  return tipo.startsWith('image/')
}

/**
 * Un error de reemplazar o quitar el comprobante adjunto, en lo que muestra el diálogo: un 400 en
 * `["archivo"]` va junto al campo (`enArchivo`); el resto (404, 409 `PAGO_ANULADO`,
 * `ADJUNTO_OBLIGATORIO`, un pago en efectivo) con el `message` de la API, que ya lo explica.
 */
export type ErrorAdjunto = { enArchivo: boolean; mensaje: string }

const MENSAJE_SIN_PERMISO = 'No tenés permiso para esta operación'
const MENSAJE_SIN_CONEXION =
  'No se pudo completar la operación. Revisá la conexión e intentá de nuevo.'

function esErrorDeArchivo(details: unknown): boolean {
  return (
    Array.isArray(details) &&
    details.some(
      (d) =>
        typeof d === 'object' &&
        d !== null &&
        Array.isArray((d as { path?: unknown }).path) &&
        (d as { path: unknown[] }).path[0] === 'archivo',
    )
  )
}

export function errorDeAdjunto(error: unknown): ErrorAdjunto {
  if (!(error instanceof ApiError)) return { enArchivo: false, mensaje: MENSAJE_SIN_CONEXION }
  if (error.status === 400 && esErrorDeArchivo(error.details)) {
    const detalle = (error.details as { path: unknown[]; message?: unknown }[]).find(
      (d) => d.path[0] === 'archivo',
    )
    const mensaje = typeof detalle?.message === 'string' ? detalle.message : error.message
    return { enArchivo: true, mensaje }
  }
  if (error.status === 403) return { enArchivo: false, mensaje: MENSAJE_SIN_PERMISO }
  return { enArchivo: false, mensaje: error.message }
}
