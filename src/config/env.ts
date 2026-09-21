import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),

  BETTER_AUTH_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  BETTER_AUTH_URL: z.url(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Variables de entorno inválidas o faltantes:\n${detalle}`)
}

export const env = parsed.data
