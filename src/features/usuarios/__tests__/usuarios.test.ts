import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorContrasena } from '../errores-api'
import { MENSAJE_OBLIGATORIA, cambiarContrasenaSchema } from '../usuarios.schema'

describe('formulario de Configuración', () => {
  it('los tres campos son obligatorios; las reglas las valida la API', () => {
    const r = cambiarContrasenaSchema.safeParse({ actual: '', nueva: 'corta', repeticion: 'otra' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ['actual', MENSAJE_OBLIGATORIA],
    ])
    // "corta" y "otra" no coinciden ni tienen 8 caracteres: eso lo responde la API, no el form.
    expect(
      cambiarContrasenaSchema.safeParse({ actual: 'a', nueva: 'corta', repeticion: 'otra' })
        .success,
    ).toBe(true)
  })
})

describe('interpretarErrorContrasena', () => {
  const error400 = (path: string, message: string) =>
    new ApiError(400, 'VALIDACION', message, [{ path: [path], message }])

  it.each([
    ['repeticion', 'Las contraseñas no coinciden'],
    ['nueva', 'La contraseña nueva no puede ser tu DNI'],
    ['actual', 'La contraseña actual no es correcta'],
  ])('cada 400 de la API va en su campo (%s)', (campo, mensaje) => {
    expect(interpretarErrorContrasena(error400(campo, mensaje))).toEqual({
      campos: [{ campo, mensaje }],
      mensaje: null,
    })
  })

  it('un 400 sin campo conocido o cualquier otro error, como mensaje general', () => {
    expect(interpretarErrorContrasena(error400('otro', 'Algo falló'))).toEqual({
      campos: [],
      mensaje: 'Algo falló',
    })
    expect(interpretarErrorContrasena(new ApiError(500, 'ERROR_INTERNO', 'Error interno'))).toEqual(
      { campos: [], mensaje: 'Error interno' },
    )
    expect(interpretarErrorContrasena(new ApiError(403, 'SIN_PERMISO', 'x')).mensaje).toBe(
      'No tenés permiso para cambiar la contraseña',
    )
  })
})
