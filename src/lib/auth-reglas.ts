// Reglas y constantes de autenticación sin efectos al importarse: no lee env, no abre Prisma ni
// crea la instancia de Better Auth. Las usan src/lib/auth.ts, el middleware de Hono y los tests
// (que corren sin variables de entorno ni base). Solo importa paquetes de better-auth.
import { APIError } from 'better-auth/api'

// ---------- Sesión ----------

/**
 * Ventana de inactividad: 60 min, confirmada por los PO (decisión T-24). Es el
 * `session.expiresIn` de Better Auth: cada renovación fija `expiresAt = ahora + este valor`.
 */
export const SESION_INACTIVIDAD_SEGUNDOS = 60 * 60

/**
 * `session.updateAge`: cada cuánto un pedido con sesión la renueva. Trade-off: cada renovación
 * es una escritura en la tabla `session` (y un Set-Cookie nuevo); a cambio, la sesión vence
 * entre `SESION_INACTIVIDAD_SEGUNDOS - SESION_RENOVACION_SEGUNDOS` (55 min) y
 * `SESION_INACTIVIDAD_SEGUNDOS` (60 min) después del último uso. Con 5 minutos, a lo sumo una
 * escritura cada 5 minutos por usuario activo.
 */
export const SESION_RENOVACION_SEGUNDOS = 5 * 60

// ---------- Contraseña ----------

/** Largo mínimo de contraseña (`emailAndPassword.minPasswordLength`; el default de Better Auth). */
export const LARGO_MINIMO_PASSWORD = 8

/** Largo máximo de contraseña (`emailAndPassword.maxPasswordLength`; el default de Better Auth). */
export const LARGO_MAXIMO_PASSWORD = 128

// ---------- Usuario inhabilitado ----------

/** Código del 403 para un usuario con `estado` distinto de ACTIVO (login y /api/v1). */
export const USUARIO_INHABILITADO = 'USUARIO_INHABILITADO'

/** Mensaje del 403 `USUARIO_INHABILITADO`. */
export const MENSAJE_USUARIO_INHABILITADO = 'Su usuario no está habilitado'

export type BuscarEstadoUsuario = (id: string) => Promise<{ estado: string } | null>

/**
 * Guarda para `databaseHooks.session.create.before`: impide crear la sesión si el usuario no
 * existe o no está ACTIVO, con un 403 `USUARIO_INHABILITADO`.
 *
 * Va en la creación de la sesión (y no antes) porque en `signInEmail` la sesión se crea
 * después de verificar la contraseña: con una contraseña incorrecta, un usuario inactivo
 * recibe el mismo 401 `INVALID_EMAIL_OR_PASSWORD` que cualquiera, y no se filtra que el email
 * existe. Solo quien conoce la contraseña ve "Su usuario no está habilitado".
 */
export function crearGuardaSesion(buscarUsuario: BuscarEstadoUsuario) {
  return async (session: { userId: string }): Promise<void> => {
    const usuario = await buscarUsuario(session.userId)
    if (usuario?.estado !== 'ACTIVO') {
      throw APIError.from('FORBIDDEN', {
        code: USUARIO_INHABILITADO,
        message: MENSAJE_USUARIO_INHABILITADO,
      })
    }
  }
}

// ---------- rememberMe ----------

/**
 * Cuerpo de `/sign-in/email` con `rememberMe: false` cambiado a `true`, o `undefined` si no hay
 * que cambiar nada (sin `rememberMe`, Better Auth ya usa `true`). Con `rememberMe: false`, Better Auth fija la sesión en 1 día y deja una cookie
 * `dont_remember` que hace que `getSession` no la renueve nunca: la sesión dejaría de vencer por
 * inactividad. Se neutraliza del lado del servidor, sin confiar en lo que mande el cliente.
 */
export function forzarRecordarSesion(path: string | undefined, body: unknown) {
  if (path !== '/sign-in/email') return undefined
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
  if ((body as { rememberMe?: unknown }).rememberMe !== false) return undefined
  return { ...body, rememberMe: true }
}
