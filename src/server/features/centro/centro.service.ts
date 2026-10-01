import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATOS_CENTRO } from './centro.datos'
import type { Centro } from './centro.validation'

// Única lógica de la feature: sin tabla, sin repository (definición G). El logo se lee del
// archivo propio de la feature, no de `public/` (así no depende de la sesión del front) ni de
// `src/config` (una feature no depende de la configuración, arquitectura-backend.md →
// Configuración). La ruta es relativa a la raíz del proyecto (`process.cwd()`), no a este archivo
// compilado: funciona igual en `pnpm dev` y en `pnpm build && pnpm start`, porque Next no mueve
// `src/` fuera del proyecto en ninguno de los dos.

const RUTA_LOGO = join(process.cwd(), 'src/server/features/centro/assets/logo.svg')
const CONTENT_TYPE_LOGO = 'image/svg+xml'

export type Logo = { bytes: ArrayBuffer; contentType: string }

export function crearCentroService() {
  return {
    /** Nombre, dirección y teléfono del centro. */
    obtenerDatos(): Centro {
      return DATOS_CENTRO
    },

    /** La imagen del logo, con su `Content-Type`. */
    async obtenerLogo(): Promise<Logo> {
      const buffer = await readFile(RUTA_LOGO)
      // `c.body()` de Hono pide `ArrayBuffer` puro: el `Buffer` de Node es un `Uint8Array` sobre
      // un `ArrayBufferLike` que no siempre tipa igual (TS 5.7+).
      const bytes = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer
      return { bytes, contentType: CONTENT_TYPE_LOGO }
    },
  }
}

export type CentroService = ReturnType<typeof crearCentroService>
