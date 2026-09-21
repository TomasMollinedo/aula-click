import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // input: false => nadie se asigna un rol al registrarse.
      // Pendiente (decisión abierta): valores del rol y su defaultValue (RECEPCION vs. mesa de entradas).
      role: { type: 'string', required: false, input: false },
    },
  },
  plugins: [nextCookies()], // debe ir último
})

export type Session = typeof auth.$Infer.Session
