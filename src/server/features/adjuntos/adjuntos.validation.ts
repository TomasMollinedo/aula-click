import { z } from '@hono/zod-openapi'
import { archivoSchema } from '@/server/shared/archivos'
import type { UsuarioAuditoria } from '@/server/shared/auditoria'

// Schemas Zod de entrada, salida y params del comprobante adjunto de un pago (HU-24, T-95). Son la
// fuente del OpenAPI. Sin reglas de negocio.

/** Tipos que se aceptan (MIME → extensión con la que se guarda) y tamaño máximo (HU-24). */
export const TIPOS_ADJUNTO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
} as const

export type TipoAdjunto = keyof typeof TIPOS_ADJUNTO

export const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024

/** Los mensajes de HU-24. Los repite el frontend en `CampoArchivo` (T-97). */
export const MENSAJES_ADJUNTO = {
  tipo: 'El archivo debe ser JPG, PNG o PDF',
  tamano: 'El archivo supera los 5 MB',
}

/** Body multipart de la subida: un único campo `archivo` (tipo, firma y tamaño, T-73). */
export const subirAdjuntoSchema = z
  .object({
    archivo: archivoSchema({
      tipos: TIPOS_ADJUNTO,
      maxBytes: MAX_BYTES_ADJUNTO,
      mensajes: MENSAJES_ADJUNTO,
    }).openapi({ description: 'JPG, PNG o PDF de hasta 5 MB' }),
  })
  .openapi('SubirAdjunto')

/** Respuesta 201 de `POST /adjuntos`: el adjunto subido, todavía sin pago. */
export const adjuntoSubidoSchema = z
  .object({
    id: z.number().int().openapi({
      description: 'Lo que se manda como `comprobanteAdjuntoId` al registrar el pago',
      example: 18,
    }),
    nombre: z
      .string()
      .openapi({ description: 'Nombre original del archivo', example: 'transferencia.pdf' }),
    tipo: z.enum(Object.keys(TIPOS_ADJUNTO) as [TipoAdjunto, ...TipoAdjunto[]]).openapi({
      description: 'Tipo MIME',
      example: 'application/pdf',
    }),
    bytes: z.number().int().openapi({ description: 'Tamaño en bytes', example: 248_312 }),
  })
  .openapi('AdjuntoSubido')

export type AdjuntoSubido = z.infer<typeof adjuntoSubidoSchema>

/**
 * El último adjunto **activo** de un pago (decisión T-136), como lo lee `ultimoAdjunto`. Lleva la
 * clave del objeto, no la URL: quien lo muestra genera la URL prefirmada. No viaja por HTTP así.
 */
export type UltimoAdjunto = {
  id: number
  archivoKey: string
  nombre: string
  tipo: TipoAdjunto
  bytes: number
  adjuntadoPor: UsuarioAuditoria
  /** Instante ISO 8601 UTC, como la auditoría. */
  adjuntadoEl: string
}

/** Lo que el service le pasa al repository para guardar un archivo ya validado. */
export type ArchivoAGuardar = { bytes: Uint8Array; tipo: TipoAdjunto; nombre: string }
