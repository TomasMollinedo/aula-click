// Ingreso del alumno con su usuario (HU-28) contra Better Auth real, con el adaptador en memoria:
// sin base ni variables de entorno. No importa auth.ts (lee env y abre Prisma): arma una
// instancia con las mismas reglas de auth-reglas.ts que usa auth.ts (plugin, rememberMe y guarda
// de usuario inhabilitado).
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { createAuthMiddleware } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  crearGuardaSesion,
  forzarRecordarSesion,
  LARGO_MAXIMO_PASSWORD,
  LARGO_MINIMO_PASSWORD,
  OPCIONES_USUARIO,
  SESION_INACTIVIDAD_SEGUNDOS,
  SESION_RENOVACION_SEGUNDOS,
} from '../auth-reglas'

const BASE_URL = 'http://localhost:3000'
type Fila = Record<string, unknown>
const db: Record<string, Fila[]> = { user: [], session: [], account: [], verification: [] }

const auth = betterAuth({
  secret: 'secreto-de-test-con-al-menos-32-caracteres',
  baseURL: BASE_URL,
  database: memoryAdapter(db),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: LARGO_MINIMO_PASSWORD,
    maxPasswordLength: LARGO_MAXIMO_PASSWORD,
  },
  session: { expiresIn: SESION_INACTIVIDAD_SEGUNDOS, updateAge: SESION_RENOVACION_SEGUNDOS },
  user: {
    additionalFields: {
      estado: { type: 'string', required: false, input: false },
      alumnoId: { type: 'number', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await crearGuardaSesion(async (id) => {
            const usuario = db.user.find((u) => u.id === id)
            return usuario ? { estado: String(usuario.estado) } : null
          })(session)
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = forzarRecordarSesion(ctx.path, ctx.body)
      if (body) return { context: { body } }
    }),
  },
  plugins: [username(OPCIONES_USUARIO)],
})

// Alta como la del seed y T-88: se escriben Usuario + Account credential (sin pasar por Better
// Auth), con la contraseña hasheada por el mismo hasher que verifica el login (hashPassword()).
async function crearCuenta(datos: { usuario: string; password: string; estado?: string }) {
  const context = await auth.$context
  const id = `u-${datos.usuario}`
  const ahora = new Date()
  db.user.push({
    id,
    name: 'Juan',
    email: `${datos.usuario}@alumnos.aulaclick.invalid`,
    emailVerified: false,
    username: datos.usuario,
    displayUsername: datos.usuario,
    estado: datos.estado ?? 'ACTIVO',
    alumnoId: 7,
    createdAt: ahora,
    updatedAt: ahora,
  })
  db.account.push({
    id: `a-${datos.usuario}`,
    userId: id,
    providerId: 'credential',
    accountId: id,
    password: await context.password.hash(datos.password),
    createdAt: ahora,
    updatedAt: ahora,
  })
}

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: BASE_URL,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

function ingresar(usuario: string, password: string, extra: Fila = {}) {
  return post('/sign-in/username', { username: usuario, password, ...extra })
}

// DNI de 7 dígitos: menos que LARGO_MINIMO_PASSWORD (8), que solo rige para la contraseña nueva.
const DNI_7 = '4512345'

beforeAll(async () => {
  await crearCuenta({ usuario: 'jperez456', password: DNI_7 })
  await crearCuenta({ usuario: 'jperez456-2', password: '45123456' })
  await crearCuenta({ usuario: 'mgomez111', password: '30111111', estado: 'INACTIVO' })
})

describe('POST /sign-in/username', () => {
  it('ingresa con el usuario y un DNI de 7 dígitos como contraseña inicial', async () => {
    expect(DNI_7.length).toBeLessThan(LARGO_MINIMO_PASSWORD)

    const res = await ingresar('jperez456', DNI_7)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ username: 'jperez456', alumnoId: 7 })
    expect(res.headers.getSetCookie().some((c) => c.includes('session_token='))).toBe(true)
  })

  it('acepta el usuario con guion de HU-27', async () => {
    expect((await ingresar('jperez456-2', '45123456')).status).toBe(200)
  })

  it('con rememberMe: false la sesión igual vence por inactividad y se renueva', async () => {
    const res = await ingresar('jperez456', DNI_7, { rememberMe: false })

    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie()
    expect(cookies.some((c) => c.includes('dont_remember'))).toBe(false)
    const { token } = await res.json()
    const sesion = db.session.find((s) => s.token === token)
    const vence = (sesion?.expiresAt as Date).getTime() - Date.now()
    expect(vence).toBeLessThanOrEqual(SESION_INACTIVIDAD_SEGUNDOS * 1000)
    expect(vence).toBeGreaterThan((SESION_INACTIVIDAD_SEGUNDOS - 60) * 1000)
  })

  it.each([
    ['usuario inexistente', 'nadie123', DNI_7],
    ['contraseña incorrecta', 'jperez456', 'otra-clave'],
  ])('%s: 401 INVALID_USERNAME_OR_PASSWORD', async (_caso, usuario, password) => {
    const res = await ingresar(usuario, password)

    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('INVALID_USERNAME_OR_PASSWORD')
  })

  it.each([
    ['muy corto', 'jp', 'USERNAME_TOO_SHORT'],
    ['muy largo', 'j'.repeat(51), 'USERNAME_TOO_LONG'],
    ['con tilde', 'jpérez456', 'INVALID_USERNAME'],
    ['un email', 'jperez@x.com', 'INVALID_USERNAME'],
  ])('usuario %s: 422 %s antes de mirar la contraseña', async (_caso, usuario, code) => {
    const res = await ingresar(usuario, DNI_7)

    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe(code)
  })

  it('un usuario inhabilitado con la contraseña correcta: 403 USUARIO_INHABILITADO, sin sesión', async () => {
    const sesionesAntes = db.session.length

    const res = await ingresar('mgomez111', '30111111')

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'USUARIO_INHABILITADO' })
    expect(db.session.length).toBe(sesionesAntes)
  })

  it('un usuario inhabilitado con la contraseña incorrecta ve el 401 de cualquiera', async () => {
    const res = await ingresar('mgomez111', 'otra-clave')

    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('INVALID_USERNAME_OR_PASSWORD')
  })
})

describe('el usuario no cambia (HU-27)', () => {
  it('POST /update-user con otro username responde 400 USERNAME_IS_IMMUTABLE', async () => {
    const login = await ingresar('jperez456', DNI_7)
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')

    const res = await post('/update-user', { username: 'otro123' }, cookie)

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('USERNAME_IS_IMMUTABLE')
    expect(db.user.find((u) => u.username === 'otro123')).toBeUndefined()
  })

  it('el registro público sigue cerrado', async () => {
    const res = await post('/sign-up/email', {
      email: 'x@x.com',
      password: '12345678',
      name: 'X',
      username: 'nuevo123',
    })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
  })
})
