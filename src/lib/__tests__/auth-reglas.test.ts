import { APIError } from 'better-auth/api'
import { describe, expect, it, vi } from 'vitest'
import {
  crearGuardaSesion,
  esUsuarioValido,
  forzarRecordarSesion,
  LARGO_MAXIMO_PASSWORD,
  LARGO_MAXIMO_USUARIO,
  LARGO_MINIMO_PASSWORD,
  LARGO_MINIMO_USUARIO,
  MENSAJE_USUARIO_INHABILITADO,
  OPCIONES_USUARIO,
  SESION_INACTIVIDAD_SEGUNDOS,
  SESION_RENOVACION_SEGUNDOS,
  USUARIO_INHABILITADO,
} from '../auth-reglas'

describe('crearGuardaSesion', () => {
  it('deja crear la sesión de un usuario ACTIVO y busca por el userId de la sesión', async () => {
    const buscar = vi.fn().mockResolvedValue({ estado: 'ACTIVO' })

    await expect(crearGuardaSesion(buscar)({ userId: 'u-1' })).resolves.toBeUndefined()
    expect(buscar).toHaveBeenCalledWith('u-1')
  })

  it('rechaza a un usuario INACTIVO con 403 USUARIO_INHABILITADO', async () => {
    const guarda = crearGuardaSesion(async () => ({ estado: 'INACTIVO' }))

    const error = await guarda({ userId: 'u-1' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(APIError)
    expect(error).toMatchObject({
      status: 'FORBIDDEN',
      statusCode: 403,
      body: { code: 'USUARIO_INHABILITADO', message: 'Su usuario no está habilitado' },
    })
  })

  it('rechaza si el usuario no existe', async () => {
    const guarda = crearGuardaSesion(async () => null)

    await expect(guarda({ userId: 'no-existe' })).rejects.toMatchObject({
      statusCode: 403,
      body: { code: USUARIO_INHABILITADO },
    })
  })
})

describe('forzarRecordarSesion', () => {
  it('cambia rememberMe: false por true en /sign-in/email, sin tocar el resto', () => {
    const body = { email: 'a@b.com', password: 'x', rememberMe: false }
    expect(forzarRecordarSesion('/sign-in/email', body)).toEqual({ ...body, rememberMe: true })
  })

  it('cambia rememberMe: false por true también en /sign-in/username (alumno)', () => {
    const body = { username: 'jperez456', password: '45123456', rememberMe: false }
    expect(forzarRecordarSesion('/sign-in/username', body)).toEqual({ ...body, rememberMe: true })
  })

  it.each([
    ['otra ruta', '/sign-up/email', { rememberMe: false }],
    ['ruta sin path', undefined, { rememberMe: false }],
    ['usuario sin rememberMe', '/sign-in/username', { username: 'jperez456' }],
    ['sin rememberMe', '/sign-in/email', { email: 'a@b.com' }],
    ['rememberMe: true', '/sign-in/email', { rememberMe: true }],
    ['sin cuerpo', '/sign-in/email', undefined],
    ['cuerpo que no es objeto', '/sign-in/email', 'texto'],
  ])('no cambia nada con %s', (_caso, path, body) => {
    expect(forzarRecordarSesion(path, body)).toBeUndefined()
  })
})

describe('esUsuarioValido', () => {
  it.each([
    ['el usuario de HU-27', 'jperez456'],
    ['con sufijo de usuario repetido (guion)', 'jperez456-2'],
    ['con punto', 'j.perez456'],
    ['un apellido compuesto largo', 'jfernandezdelacolina456-2'],
  ])('acepta %s', (_caso, usuario) => {
    expect(esUsuarioValido(usuario)).toBe(true)
  })

  it.each([
    ['con mayúsculas', 'JPerez456'],
    ['con tilde', 'jpérez456'],
    ['con ñ', 'jnuñez456'],
    ['con espacio', 'j perez456'],
    ['con guion bajo', 'j_perez456'],
    ['con @ (un email)', 'jperez@x.com'],
    ['vacío', ''],
  ])('rechaza un usuario %s', (_caso, usuario) => {
    expect(esUsuarioValido(usuario)).toBe(false)
  })

  it('el plugin usa estas reglas, un máximo de 50 y el usuario no se puede cambiar', () => {
    expect(OPCIONES_USUARIO).toEqual({
      minUsernameLength: LARGO_MINIMO_USUARIO,
      maxUsernameLength: LARGO_MAXIMO_USUARIO,
      usernameValidator: esUsuarioValido,
      immutableUsername: true,
    })
    expect(LARGO_MAXIMO_USUARIO).toBe(50)
  })
})

describe('constantes', () => {
  it('el mensaje de usuario inhabilitado es el de la HU', () => {
    expect(MENSAJE_USUARIO_INHABILITADO).toBe('Su usuario no está habilitado')
    expect(USUARIO_INHABILITADO).toBe('USUARIO_INHABILITADO')
  })

  it('la renovación es más frecuente que el vencimiento por inactividad', () => {
    expect(SESION_RENOVACION_SEGUNDOS).toBeGreaterThan(0)
    expect(SESION_RENOVACION_SEGUNDOS).toBeLessThan(SESION_INACTIVIDAD_SEGUNDOS)
  })

  it('el largo de contraseña es coherente', () => {
    expect(LARGO_MINIMO_PASSWORD).toBe(8)
    expect(LARGO_MINIMO_PASSWORD).toBeLessThan(LARGO_MAXIMO_PASSWORD)
  })
})
