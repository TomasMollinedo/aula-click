import { z } from '@hono/zod-openapi'

// Schema de `GET /centro`. Sin reglas de negocio: son constantes (`centro.datos.ts`).

export const centroSchema = z
  .object({
    nombre: z.string(),
    direccion: z.string(),
    telefono: z.string(),
  })
  .openapi('Centro')

export type Centro = z.infer<typeof centroSchema>
