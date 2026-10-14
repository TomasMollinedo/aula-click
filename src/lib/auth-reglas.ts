// Reglas y constantes de autenticación sin efectos al importarse: no lee env, no abre Prisma ni
// crea la instancia de Better Auth. Las usan src/lib/auth.ts, el middleware de Hono y los tests
// (que corren sin variables de entorno ni base). Solo importa paquetes de better-auth.
import { APIError } from 'better-auth/api'
import type { UsernameOptions } from 'better-auth/plugins'

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

// ---------- Usuario del alumno (plugin username) ----------

/** Largo mínimo del usuario de ingreso del alumno (`minUsernameLength`; el default del plugin). */
export const LARGO_MINIMO_USUARIO = 3

/**
 * Largo máximo del usuario (`maxUsernameLength`). El default del plugin (30) no alcanza para un
 * apellido compuesto con sufijo: "jfernandezdelacolina456-2" (HU-27) ya tiene 25.
 */
export const LARGO_MAXIMO_USUARIO = 50

/**
 * `usernameValidator` del plugin: minúsculas, números, `.` y `-`. El del plugin
 * (`/^[a-zA-Z0-9_.]+$/`) rechaza el guion del sufijo de HU-27 ("jperez456-2"). El largo lo mide
 * el plugin.
 */
export function esUsuarioValido(usuario: string): boolean {
  return /^[a-z0-9.-]+$/.test(usuario)
}

/**
 * Opciones del plugin `username` (`username(OPCIONES_USUARIO)` en auth.ts). La normalización a
 * minúsculas es la del plugin. `immutableUsername`: `POST /api/auth/update-user` acepta un
 * `username` en el cuerpo (el plugin no lo declara `input: false`); con esta opción, a quien ya
 * tiene usuario le responde 400 `USERNAME_IS_IMMUTABLE` (HU-27: el usuario no cambia).
 */
export const OPCIONES_USUARIO = {
  minUsernameLength: LARGO_MINIMO_USUARIO,
  maxUsernameLength: LARGO_MAXIMO_USUARIO,
  usernameValidator: esUsuarioValido,
  immutableUsername: true,
} satisfies UsernameOptions

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

/** Rutas de ingreso: con email (personal) y con usuario (alumno, plugin username). */
const RUTAS_DE_INGRESO: readonly (string | undefined)[] = ['/sign-in/email', '/sign-in/username']

/**
 * Cuerpo de una ruta de ingreso (`/sign-in/email` o `/sign-in/username`) con `rememberMe: false`
 * cambiado a `true`, o `undefined` si no hay que cambiar nada (sin `rememberMe`, Better Auth ya
 * usa `true`). Con `rememberMe: false`, Better Auth fija la sesión en 1 día y deja una cookie
 * `dont_remember` que hace que `getSession` no la renueve nunca: la sesión dejaría de vencer por
 * inactividad. Se neutraliza del lado del servidor, sin confiar en lo que mande el cliente.
 */
export function forzarRecordarSesion(path: string | undefined, body: unknown) {
  if (!RUTAS_DE_INGRESO.includes(path)) return undefined
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
  if ((body as { rememberMe?: unknown }).rememberMe !== false) return undefined
  return { ...body, rememberMe: true }
}
