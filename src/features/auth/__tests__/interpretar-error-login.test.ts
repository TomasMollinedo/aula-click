import { describe, expect, it } from 'vitest'
import { INVALID_EMAIL_OR_PASSWORD, USUARIO_INHABILITADO } from '../codigos-error'
import { interpretarErrorLogin } from '../interpretar-error-login'

const GENERICO = 'No se pudo iniciar sesión. Intentá de nuevo en unos minutos.'

describe('interpretarErrorLogin', () => {
  it('elige por code y no por el message en inglés de Better Auth', () => {
    const mensaje = interpretarErrorLogin({
      status: 401,
      code: INVALID_EMAIL_OR_PASSWORD,
      message: 'Invalid email or password',
    })

    expect(mensaje).toBe('Usuario o contraseña incorrectos')
  })

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
