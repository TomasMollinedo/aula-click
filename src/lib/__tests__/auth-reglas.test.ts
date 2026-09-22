import { APIError } from 'better-auth/api'
import { describe, expect, it, vi } from 'vitest'
import {
  crearGuardaSesion,
  forzarRecordarSesion,
  LARGO_MAXIMO_PASSWORD,
  LARGO_MINIMO_PASSWORD,
  MENSAJE_USUARIO_INHABILITADO,
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

  it.each([
    ['otra ruta', '/sign-up/email', { rememberMe: false }],
    ['sin rememberMe', '/sign-in/email', { email: 'a@b.com' }],
    ['rememberMe: true', '/sign-in/email', { rememberMe: true }],
    ['sin cuerpo', '/sign-in/email', undefined],
    ['cuerpo que no es objeto', '/sign-in/email', 'texto'],
  ])('no cambia nada con %s', (_caso, path, body) => {
    expect(forzarRecordarSesion(path, body)).toBeUndefined()
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
