import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorCuenta } from '../errores-cuentas'

describe('interpretarErrorCuenta', () => {
  it('404: el alumno no existe, sin reintentar', () => {
    expect(
      interpretarErrorCuenta(new ApiError(404, 'NO_ENCONTRADO', 'Alumno no encontrado')),
    ).toEqual({ mensaje: 'El alumno no existe', reintentar: false })
  })

  it('400: id inválido, sin reintentar', () => {
    expect(interpretarErrorCuenta(new ApiError(400, 'VALIDACION', 'Datos inválidos'))).toEqual({
      mensaje: 'El alumno indicado no es válido',
      reintentar: false,
    })
  })

  it('403: sin permiso, sin reintentar', () => {
    expect(interpretarErrorCuenta(new ApiError(403, 'SIN_PERMISO', 'Sin permiso'))).toEqual({
      mensaje: 'No tenés permiso para ver los pagos',
      reintentar: false,
    })
  })

  it('500, red o desconocido: genérico con reintentar', () => {
    const generico = {
      mensaje: 'No se pudieron cargar los pagos. Revisá la conexión e intentá de nuevo.',
      reintentar: true,
    }
    expect(interpretarErrorCuenta(new ApiError(500, 'ERROR_INTERNO', 'Error'))).toEqual(generico)
    // Un error de red lo lanza fetch: no es un ApiError y no trae status.
    expect(interpretarErrorCuenta(new TypeError('Failed to fetch') as unknown as ApiError)).toEqual(
      generico,
    )
    expect(interpretarErrorCuenta(null)).toEqual(generico)
  })
})
