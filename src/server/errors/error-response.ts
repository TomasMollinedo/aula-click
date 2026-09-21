import { z } from '@hono/zod-openapi'

// Cuerpo JSON de todo error de la API; las rutas lo usan en sus respuestas 4xx.
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse')

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
