import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/config/env'

// 15 min: la foto no vence mientras el usuario sigue en pantalla.
const DEFAULT_URL_TTL_SECONDS = 900

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // MinIO usa rutas (host/bucket/clave), no subdominios
})

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

/**
 * `Content-Disposition: inline` con el nombre original: el navegador lo abre en la pestaña (un PDF o
 * una imagen) en lugar de descargarlo, y si se guarda, se guarda con ese nombre. `filename` va en
 * ASCII (sin tildes ni comillas) y `filename*` en UTF-8 (RFC 6266), para los navegadores que lo leen.
 */
function contentDispositionInline(nombreArchivo: string): string {
  const ascii = nombreArchivo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\]/g, '_')
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`
}

// En la base se guarda la clave del objeto; la URL prefirmada se genera al mostrarlo. Con `inline`,
// la URL abre el archivo en otra pestaña con su nombre (el comprobante adjunto de un pago, T-95).
export function getPresignedUrl(
  key: string,
  ttlSeconds = DEFAULT_URL_TTL_SECONDS,
  opciones: { inline?: { nombreArchivo: string } } = {},
) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ...(opciones.inline
        ? { ResponseContentDisposition: contentDispositionInline(opciones.inline.nombreArchivo) }
        : {}),
    }),
    { expiresIn: ttlSeconds },
  )
}
