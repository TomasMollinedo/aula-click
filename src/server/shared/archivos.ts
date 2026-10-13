import { randomUUID } from 'node:crypto'
import { z } from '@hono/zod-openapi'

/** Tipos permitidos de un campo de archivo: tipo MIME → extensión con la que se guarda. */
export type TiposArchivo = Readonly<Record<string, string>>

export type MensajesArchivo = {
  /** El archivo no es de un tipo permitido, o su contenido no corresponde al tipo que declara. */
  tipo: string
  /** El archivo supera `maxBytes`. */
  tamano: string
  /** Lo que llegó en el campo no es un archivo. Por defecto, "Debe subir un archivo". */
  requerido?: string
}

// Primeros bytes (firma) de cada tipo que se sabe reconocer. Un tipo en `tipos` que no esté acá
// no se puede verificar, y `archivoSchema` falla al armarse en lugar de aceptarlo sin revisar.
const FIRMAS: Readonly<Record<string, readonly number[]>> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
}

const BYTES_DE_FIRMA = Math.max(...Object.values(FIRMAS).map((firma) => firma.length))

async function tieneLaFirmaDe(archivo: File, tipo: string): Promise<boolean> {
  const firma = FIRMAS[tipo]
  if (!firma) return false
  const inicio = new Uint8Array(await archivo.slice(0, BYTES_DE_FIRMA).arrayBuffer())
  return firma.every((byte, i) => inicio[i] === byte)
}

/**
 * Campo de archivo de un body multipart (`File`). Rechaza, con el primer mensaje que corresponda:
 * lo que no es un archivo, un tipo MIME fuera de `tipos`, un archivo de más de `maxBytes` y un
 * archivo cuyo contenido no es del tipo que declara (un PNG renombrado a `.pdf`): además del tipo
 * que declara el navegador se verifica la firma, o sea los primeros bytes del archivo.
 *
 * Los mensajes los pasa quien lo usa ("La foto debe ser JPG o PNG"): viajan al usuario en
 * `details` del 400. La validación es asíncrona (lee los primeros bytes): la corren las rutas
 * (`createRoute`) y `parseAsync`.
 */
export function archivoSchema({
  tipos,
  maxBytes,
  mensajes,
}: {
  tipos: TiposArchivo
  maxBytes: number
  mensajes: MensajesArchivo
}) {
  const sinFirma = Object.keys(tipos).filter((tipo) => !(tipo in FIRMAS))
  if (sinFirma.length > 0) {
    throw new Error(`archivoSchema: no hay firma conocida para ${sinFirma.join(', ')}`)
  }

  return z
    .instanceof(File, { error: mensajes.requerido ?? 'Debe subir un archivo' })
    .check(async (ctx) => {
      const archivo = ctx.value
      let mensaje: string | null = null
      if (!Object.hasOwn(tipos, archivo.type)) mensaje = mensajes.tipo
      else if (archivo.size > maxBytes) mensaje = mensajes.tamano
      else if (!(await tieneLaFirmaDe(archivo, archivo.type))) mensaje = mensajes.tipo
      if (mensaje) ctx.issues.push({ code: 'custom', message: mensaje, input: archivo })
    })
    .openapi({ type: 'string', format: 'binary' })
}

/** Clave única para guardar un archivo: `<carpeta>/<uuid>.<extensión>`. */
export function claveDeArchivo(carpeta: string, extension: string): string {
  return `${carpeta}/${randomUUID()}.${extension}`
}
