import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { MENSAJE_CAJA_INVALIDA, interpretarErrorCaja } from '../errores-caja'

// El error de `GET /caja` en lo que muestra la pantalla: el 400 va junto a su campo (la fecha,
// arriba del selector; el tipo y la forma de pago, en su filtro).

const MENSAJE_FECHA_FUTURA = 'No se puede consultar la caja de una fecha futura'

function errorDeValidacion(details: unknown) {
  return new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', details)
}

describe('interpretarErrorCaja', () => {
  it('una fecha futura sale junto al selector, con el mensaje de la API', () => {
    const error = interpretarErrorCaja(
      errorDeValidacion([{ path: ['fecha'], message: MENSAJE_FECHA_FUTURA }]),
    )
    expect(error).toEqual({
      tipo: 'validacion',
      mensaje: null,
      campos: { fecha: MENSAJE_FECHA_FUTURA },
      reintentar: false,
    })
  })

  it('un tipo y una forma de pago inválidos van cada uno a su filtro', () => {
    const error = interpretarErrorCaja(
      errorDeValidacion([
        { path: ['tipo'], message: 'El tipo no existe' },
        { path: ['formaPago'], message: 'La forma de pago no existe' },
      ]),
    )
    expect(error.campos).toEqual({
      tipo: 'El tipo no existe',
      formaPago: 'La forma de pago no existe',
    })
    expect(error.mensaje).toBeNull()
  })

  it('un 400 que no se puede ubicar deja el mensaje general', () => {
    expect(interpretarErrorCaja(errorDeValidacion(undefined)).mensaje).toBe(MENSAJE_CAJA_INVALIDA)
    expect(interpretarErrorCaja(errorDeValidacion([{ path: ['otro'], message: 'x' }]))).toEqual({
      tipo: 'validacion',
      mensaje: MENSAJE_CAJA_INVALIDA,
      campos: {},
      reintentar: false,
    })
  })

  it('un 403 es "sin permiso" y no se reintenta: la caja es sólo del gerente', () => {
    const error = interpretarErrorCaja(new ApiError(403, 'SIN_PERMISO', 'Sin permiso'))
    expect(error.tipo).toBe('sinPermiso')
    expect(error.mensaje).toBe('No tenés permiso para ver la caja')
    expect(error.reintentar).toBe(false)
  })

  it('cualquier otro error (500, red) es genérico y se puede reintentar', () => {
    const error = interpretarErrorCaja(new ApiError(500, 'ERROR_INTERNO', 'Error'))
    expect(error.tipo).toBe('general')
    expect(error.reintentar).toBe(true)
    expect(interpretarErrorCaja(null).tipo).toBe('general')
  })
})
