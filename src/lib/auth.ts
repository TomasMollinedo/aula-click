import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'

// Campos de dominio de Usuario que son NOT NULL en la base. Se declaran para que Better Auth
// los conozca: con `required: true` e `input: false`, un alta por la API pública responde
// 400 ("<campo> is required") en lugar de fallar en la base. Los usuarios se crean escribiendo
// Usuario + Account (ver hashPassword y prisma/seed.ts), nunca desde el cliente.
const campoInterno = { type: 'string', required: true, input: false } as const

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // disableSignUp y el bloqueo de login por Usuario.estado se agregan en T-03.
  emailAndPassword: { enabled: true },
  user: {
    // Nombre del delegate de Prisma (prisma.usuario) del modelo Usuario.
    modelName: 'usuario',
    fields: { name: 'nombre' },
    additionalFields: {
      // FK a Rol.id: MESA_ENTRADAS, PROFESOR, GERENTE o ALUMNO. Nadie se asigna un rol.
      role: campoInterno,
      apellido: campoInterno,
      dni: campoInterno,
      busqueda: { ...campoInterno, returned: false },
      telefono: campoInterno,
      estado: { ...campoInterno, defaultValue: 'ACTIVO' },
    },
  },
  plugins: [nextCookies()], // debe ir último
})

export type Session = typeof auth.$Infer.Session

/**
 * Hashea una contraseña con el mismo algoritmo que usa Better Auth para verificarla en el login.
 * Lo usan el seed y el alta de cuentas (Account con providerId 'credential').
 */
export async function hashPassword(plain: string): Promise<string> {
  const context = await auth.$context
  return context.password.hash(plain)
}
