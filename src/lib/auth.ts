import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { openAPI } from 'better-auth/plugins'
import { env } from '@/config/env'
import {
  crearGuardaSesion,
  forzarRecordarSesion,
  LARGO_MAXIMO_PASSWORD,
  LARGO_MINIMO_PASSWORD,
  SESION_INACTIVIDAD_SEGUNDOS,
  SESION_RENOVACION_SEGUNDOS,
} from '@/lib/auth-reglas'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/server/shared/actor'

// Campos de dominio de Usuario que son NOT NULL en la base. Se declaran para que Better Auth
// los conozca: con `required: true` e `input: false`, nadie los define desde el cliente. Los
// usuarios se crean escribiendo Usuario + Account (ver hashPassword y prisma/seed.ts).
const campoInterno = { type: 'string', required: true, input: false } as const

// Bloquea la creación de sesión (login) de un usuario que no está ACTIVO. Se consulta Prisma
// directo, y no el internalAdapter del contexto, porque el contexto del hook puede ser null y
// así se lee una sola columna. Detalle y porqué del momento elegido en auth-reglas.ts.
const guardaSesion = crearGuardaSesion((id) =>
  prisma.usuario.findUnique({ where: { id }, select: { estado: true } }),
)

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    // Sin registro público: POST /api/auth/sign-up/email responde 400
    // EMAIL_PASSWORD_SIGN_UP_DISABLED (también bloquea auth.api.signUpEmail).
    disableSignUp: true,
    minPasswordLength: LARGO_MINIMO_PASSWORD,
    maxPasswordLength: LARGO_MAXIMO_PASSWORD,
  },
  // Vence por inactividad: cada pedido con sesión la renueva (a lo sumo cada updateAge).
  // Sin cookieCache: un usuario dado de baja dejaría de verse recién al vencer la caché.
  session: {
    expiresIn: SESION_INACTIVIDAD_SEGUNDOS,
    updateAge: SESION_RENOVACION_SEGUNDOS,
  },
  user: {
    // Nombre del delegate de Prisma (prisma.usuario) del modelo Usuario.
    modelName: 'usuario',
    fields: { name: 'nombre' },
    additionalFields: {
      // FK de texto a Rol.id. Nadie se asigna un rol.
      role: { type: [...ROLES], required: true, input: false },
      apellido: campoInterno,
      dni: campoInterno,
      busqueda: { ...campoInterno, returned: false },
      telefono: campoInterno,
      estado: { ...campoInterno, defaultValue: 'ACTIVO' },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await guardaSesion(session)
        },
      },
    },
  },
  hooks: {
    // rememberMe: false dejaría una sesión de 1 día que nunca se renueva (ver auth-reglas.ts).
    before: createAuthMiddleware(async (ctx) => {
      const body = forzarRecordarSesion(ctx.path, ctx.body)
      if (body) return { context: { body } }
    }),
  },
  plugins: [
    // Documentación de /api/auth/* (login, logout, sesión): Swagger UI en /api/v1/docs es de la
    // API de negocio (Hono) y no puede listar Better Auth, que es otro motor (decisión T-03,
    // arquitectura-backend.md). openAPI() genera la suya propia, aparte, en /api/auth/reference.
    openAPI(),
    nextCookies(), // debe ir último
  ],
})

export type Session = typeof auth.$Infer.Session

/**
 * Hashea una contraseña con el mismo algoritmo que usa Better Auth para verificarla en el login.
 * Lo usan el seed y el alta de cuentas (Account con providerId 'credential'); el largo se valida
 * antes con LARGO_MINIMO_PASSWORD / LARGO_MAXIMO_PASSWORD de auth-reglas.ts.
 */
export async function hashPassword(plain: string): Promise<string> {
  const context = await auth.$context
  return context.password.hash(plain)
}
