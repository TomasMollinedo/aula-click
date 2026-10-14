import { describe, expect, it } from 'vitest'
import {
  INVALID_EMAIL_OR_PASSWORD,
  INVALID_USERNAME,
  INVALID_USERNAME_OR_PASSWORD,
  USERNAME_TOO_LONG,
  USERNAME_TOO_SHORT,
  USUARIO_INHABILITADO,
} from '../codigos-error'
import { interpretarErrorLogin } from '../interpretar-error-login'

const GENERICO = 'No se pudo iniciar sesión. Intentá de nuevo en unos minutos.'

describe('interpretarErrorLogin', () => {
  it('elige por code y no por el message en inglés de Better Auth', () => {
    const mensaje = interpretarErrorLogin({
      status: 401,
      code: INVALID_EMAIL_OR_PASSWORD,
      message: 'Invalid email or password',
    })

    expect(mensaje).toBe('Usuario/email o contraseña incorrectos')
  })

  it.each([
    [401, INVALID_USERNAME_OR_PASSWORD],
    [422, USERNAME_TOO_SHORT],
    [422, USERNAME_TOO_LONG],
    [422, INVALID_USERNAME],
  ])(
    'ingreso por usuario: %i %s dice lo mismo que una credencial incorrecta (T-75)',
    (status, code) => {
      expect(interpretarErrorLogin({ status, code, message: 'Invalid username' })).toBe(
        'Usuario/email o contraseña incorrectos',
      )
    },
  )

  it('avisa que el usuario está inhabilitado con el 403 del contrato', () => {
    expect(interpretarErrorLogin({ status: 403, code: USUARIO_INHABILITADO })).toBe(
      'Su usuario no está habilitado',
    )
  })

  it('con un code desconocido o sin code no dice que las credenciales estén mal', () => {
    expect(interpretarErrorLogin({ status: 500, code: 'CODE_QUE_NO_CONOCEMOS' })).toBe(GENERICO)
    expect(interpretarErrorLogin({ status: 0 })).toBe(GENERICO)
  })
})
