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

  // Solo para prisma/seed.ts (desarrollo). Opcionales: la app arranca sin ellas y el seed
  // falla con un mensaje claro si falta alguna.
  SEED_MESA_ENTRADAS_EMAIL: z.email().optional(),
  SEED_MESA_ENTRADAS_PASSWORD: z.string().min(8).optional(),
  SEED_PROFESOR_EMAIL: z.email().optional(),
  SEED_PROFESOR_PASSWORD: z.string().min(8).optional(),
  SEED_GERENTE_EMAIL: z.email().optional(),
  SEED_GERENTE_PASSWORD: z.string().min(8).optional(),
  // Alumno de demo con acceso al portal (HU-27): su usuario sale de estos datos y su contraseña
  // inicial es su DNI. Opcionales: si falta alguna, el seed usa un valor por defecto.
  SEED_ALUMNO_NOMBRE: z.string().min(1).optional(),
  SEED_ALUMNO_APELLIDO: z.string().min(1).optional(),
  SEED_ALUMNO_DNI: z
    .string()
    .regex(/^\d{7,8}$/, 'debe tener 7 u 8 dígitos, sin puntos')
    .optional(),
  SEED_ALUMNO_TELEFONO: z.string().min(1).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Variables de entorno inválidas o faltantes:\n${detalle}`)
}

export const env = parsed.data
