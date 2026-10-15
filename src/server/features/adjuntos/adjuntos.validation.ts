import { z } from '@hono/zod-openapi'
import { archivoSchema } from '@/server/shared/archivos'
import { usuarioAuditoriaSchema, type UsuarioAuditoria } from '@/server/shared/auditoria'

// Schemas Zod de entrada, salida y params del comprobante adjunto de un pago (HU-24, T-95) o de la
// transferencia a un profesor (HU-44, T-123). Son la fuente del OpenAPI. Sin reglas de negocio.

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

/** Respuesta 201 de `POST /adjuntos`: el adjunto subido, todavía sin pago ni liquidación. */
export const adjuntoSubidoSchema = z
  .object({
    id: z.number().int().openapi({
      description:
        'Lo que se manda como `comprobanteAdjuntoId` al registrar el pago o la transferencia a un profesor',
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

/** `pagoId` del path. Uno no numérico, cero o negativo responde 400. */
export const pagoIdParamsSchema = z.object({
  pagoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'pagoId', in: 'path' }, description: 'Id del pago', example: 30 }),
})

/** `liquidacionId` del path. Uno no numérico, cero o negativo responde 400. */
export const liquidacionIdParamsSchema = z.object({
  liquidacionId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'liquidacionId', in: 'path' },
      description: 'Id de la liquidación',
      example: 7,
    }),
})

/** Body multipart del reemplazo: el mismo campo `archivo` que la subida. */
export const reemplazarAdjuntoSchema = subirAdjuntoSchema.openapi('ReemplazarAdjunto')

/**
 * Respuesta de `GET /adjuntos/pagos/{pagoId}` (y del `PUT`): el último adjunto activo del pago, con
 * una URL prefirmada que lo abre en otra pestaña y quién lo adjuntó y cuándo.
 */
export const adjuntoDePagoSchema = adjuntoSubidoSchema
  .extend({
    url: z.string().openapi({
      description: 'URL prefirmada (15 min) que abre el archivo en otra pestaña',
      example: 'https://minio.local/aula-click/adjuntos/3f1c….pdf?X-Amz-…',
    }),
    adjuntadoPor: usuarioAuditoriaSchema,
    adjuntadoEl: z.iso.datetime().openapi({
      description: 'Cuándo se adjuntó (ISO 8601 UTC)',
      example: '2026-10-14T13:45:00.000Z',
    }),
  })
  .openapi('AdjuntoDePago')

export type AdjuntoDePago = z.infer<typeof adjuntoDePagoSchema>

/**
 * Respuesta de `GET /adjuntos/liquidaciones/{liquidacionId}`: el comprobante de la transferencia a
 * un profesor, con la misma forma que el de un pago.
 */
export const adjuntoDeLiquidacionSchema = adjuntoDePagoSchema.openapi('AdjuntoDeLiquidacion')

/**
 * Lo que el service necesita del pago para decidir: su estado y el tipo de su forma de pago (`null`
 * en una forma sin tipo, decisión T-134). `null` si el pago no existe. No viaja por HTTP.
 */
export type PagoDelAdjunto = {
  estado: 'VIGENTE' | 'ANULADO'
  tipoFormaPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | null
}

/**
 * El último adjunto **activo** de un pago o de una liquidación (decisión T-136), como lo leen
 * `ultimoAdjunto` y `ultimoAdjuntoDeLiquidacion`. Lleva la clave del objeto, no la URL: quien lo
 * muestra genera la URL prefirmada. No viaja por HTTP así.
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
