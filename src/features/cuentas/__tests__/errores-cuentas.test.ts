import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { MENSAJE_FILTROS_INVALIDOS, interpretarErrorCuenta } from '../errores-cuentas'

const validacion = (details?: unknown) =>
  new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', details)

// El mensaje del período tal como lo manda la API (`cuentas.validation.ts` del servidor).
const HASTA_ANTERIOR = 'La fecha hasta no puede ser anterior a la fecha desde'

describe('interpretarErrorCuenta', () => {
  it('404: el alumno no existe, sin reintentar', () => {
    expect(
      interpretarErrorCuenta(new ApiError(404, 'NO_ENCONTRADO', 'Alumno no encontrado')),
    ).toEqual({
      tipo: 'noEncontrado',
      mensaje: 'El alumno no existe',
      campos: {},
      reintentar: false,
    })
  })

  it('403: sin permiso, sin reintentar', () => {
    expect(interpretarErrorCuenta(new ApiError(403, 'SIN_PERMISO', 'Sin permiso'))).toEqual({
      tipo: 'sinPermiso',
      mensaje: 'No tenés permiso para ver los pagos',
      campos: {},
      reintentar: false,
    })
  })

  it('500, red o desconocido: genérico con reintentar', () => {
    const generico = {
      tipo: 'general',
      mensaje: 'No se pudieron cargar los pagos. Revisá la conexión e intentá de nuevo.',
      campos: {},
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

describe('interpretarErrorCuenta: 400 de los filtros', () => {
  it('`hasta` anterior a `desde`: error del campo "Hasta", con el mensaje de la API tal cual', () => {
    const error = validacion([{ code: 'custom', path: ['hasta'], message: HASTA_ANTERIOR }])

    expect(interpretarErrorCuenta(error)).toEqual({
      tipo: 'filtros',
      mensaje: null,
      campos: { hasta: HASTA_ANTERIOR },
      reintentar: false,
    })
  })

  it('varios campos: cada uno con su mensaje, y el primero si un campo se repite', () => {
    const error = validacion([
      { path: ['desde'], message: 'Fecha inválida' },
      { path: ['materiaId'], message: 'Debe ser mayor a 0' },
      { path: ['materiaId'], message: 'Debe ser un número entero' },
    ])

    expect(interpretarErrorCuenta(error)).toMatchObject({
      tipo: 'filtros',
      mensaje: null,
      campos: { desde: 'Fecha inválida', materiaId: 'Debe ser mayor a 0' },
    })
  })

  it('sin `details`: error general de los filtros', () => {
    expect(interpretarErrorCuenta(validacion())).toEqual({
      tipo: 'filtros',
      mensaje: MENSAJE_FILTROS_INVALIDOS,
      campos: {},
      reintentar: false,
    })
    expect(interpretarErrorCuenta(validacion([])).mensaje).toBe(MENSAJE_FILTROS_INVALIDOS)
  })

  it.each([
    ['un campo que no es un filtro', [{ path: ['page'], message: 'Debe ser mayor a 0' }]],
    ['un path de más de un nivel', [{ path: ['hasta', 0], message: 'x' }]],
    ['un path vacío', [{ path: [], message: 'x' }]],
    ['sin path', [{ message: 'x' }]],
    ['sin message', [{ path: ['hasta'] }]],
    ['un detalle que no es un objeto', ['hasta']],
    ['unos `details` que no son una lista', { hasta: 'x' }],
  ])('si no se puede ubicar en un campo (%s): error general', (_, details) => {
    expect(interpretarErrorCuenta(validacion(details))).toEqual({
      tipo: 'filtros',
      mensaje: MENSAJE_FILTROS_INVALIDOS,
      campos: {},
      reintentar: false,
    })
  })

  it('lo ubicado va en su campo y lo demás deja el error general', () => {
    const error = validacion([
      { path: ['hasta'], message: HASTA_ANTERIOR },
      { path: ['page'], message: 'Debe ser mayor a 0' },
    ])

    expect(interpretarErrorCuenta(error)).toMatchObject({
      mensaje: MENSAJE_FILTROS_INVALIDOS,
      campos: { hasta: HASTA_ANTERIOR },
    })
  })
})
