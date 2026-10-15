import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  MENSAJE_ALUMNO_NO_ENCONTRADO,
  MENSAJE_FILTROS_INVALIDOS,
  MENSAJE_GENERAL,
  MENSAJE_SIN_PERMISO,
  interpretarErrorHistorial,
} from '../errores-historiales'

// El error de la lectura del historial en lo que muestra la pantalla (T-109): el único lugar de
// `historiales` que conoce la forma de los `details` del 400.

const validacion = (details?: unknown) =>
  new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', details)

// Los mensajes del período tal como los manda la API (`historiales.reglas.ts` del servidor).
const HASTA_ANTERIOR = 'La fecha hasta no puede ser anterior a la fecha desde'
const PERIODO_MAXIMO = 'El período no puede superar los 366 días'

describe('interpretarErrorHistorial', () => {
  it('404: el alumno no existe, sin reintentar', () => {
    expect(
      interpretarErrorHistorial(new ApiError(404, 'NO_ENCONTRADO', 'Alumno no encontrado')),
    ).toEqual({
      tipo: 'noEncontrado',
      mensaje: MENSAJE_ALUMNO_NO_ENCONTRADO,
      campos: {},
      reintentar: false,
    })
  })

  it('403: sin permiso (el profesor sin turnos con el alumno), sin reintentar', () => {
    expect(
      interpretarErrorHistorial(
        new ApiError(403, 'SIN_PERMISO', 'El alumno no tiene turnos con usted'),
      ),
    ).toEqual({
      tipo: 'sinPermiso',
      mensaje: MENSAJE_SIN_PERMISO,
      campos: {},
      reintentar: false,
    })
  })

  it('500, red o desconocido: genérico con reintentar', () => {
    const generico = {
      tipo: 'general',
      mensaje: MENSAJE_GENERAL,
      campos: {},
      reintentar: true,
    }
    expect(interpretarErrorHistorial(new ApiError(500, 'ERROR', 'Error interno'))).toEqual(generico)
    expect(interpretarErrorHistorial(null)).toEqual(generico)
    expect(interpretarErrorHistorial(undefined)).toEqual(generico)
  })

  it('400 del período invertido: el `message` de la API va a `hasta`, sin error general', () => {
    expect(
      interpretarErrorHistorial(validacion([{ path: ['hasta'], message: HASTA_ANTERIOR }])),
    ).toEqual({
      tipo: 'filtros',
      mensaje: null,
      campos: { hasta: HASTA_ANTERIOR },
      reintentar: false,
    })
  })

  it('400 del tope de días: también sobre `hasta`, con su propio texto', () => {
    expect(
      interpretarErrorHistorial(validacion([{ path: ['hasta'], message: PERIODO_MAXIMO }])),
    ).toMatchObject({ campos: { hasta: PERIODO_MAXIMO } })
  })

  it('ubica cada campo conocido', () => {
    expect(
      interpretarErrorHistorial(
        validacion([
          { path: ['desde'], message: 'Fecha inválida' },
          { path: ['materiaId'], message: 'Debe ser un número' },
          { path: ['profesorId'], message: 'Debe ser mayor a 0' },
        ]),
      ),
    ).toEqual({
      tipo: 'filtros',
      mensaje: null,
      campos: {
        desde: 'Fecha inválida',
        materiaId: 'Debe ser un número',
        profesorId: 'Debe ser mayor a 0',
      },
      reintentar: false,
    })
  })

  it('de un mismo campo gana el primer mensaje', () => {
    expect(
      interpretarErrorHistorial(
        validacion([
          { path: ['hasta'], message: HASTA_ANTERIOR },
          { path: ['hasta'], message: PERIODO_MAXIMO },
        ]),
      ).campos.hasta,
    ).toBe(HASTA_ANTERIOR)
  })

  it('un 400 sin `details` queda como error general de los filtros', () => {
    expect(interpretarErrorHistorial(validacion())).toEqual({
      tipo: 'filtros',
      mensaje: MENSAJE_FILTROS_INVALIDOS,
      campos: {},
      reintentar: false,
    })
  })

  it('un detalle que no se puede ubicar deja además el error general', () => {
    expect(
      interpretarErrorHistorial(
        validacion([
          { path: ['hasta'], message: HASTA_ANTERIOR },
          { path: ['otraCosa'], message: 'Algo' },
        ]),
      ),
    ).toEqual({
      tipo: 'filtros',
      mensaje: MENSAJE_FILTROS_INVALIDOS,
      campos: { hasta: HASTA_ANTERIOR },
      reintentar: false,
    })
  })

  it('detalles con formas raras no rompen: queda el error general', () => {
    for (const details of [
      'un texto',
      [null],
      [{ path: 'hasta', message: 'x' }],
      [{ path: ['hasta'] }],
      [{ path: ['hasta', 1], message: 'x' }],
      [{ path: [], message: 'x' }],
    ]) {
      expect(interpretarErrorHistorial(validacion(details))).toMatchObject({
        tipo: 'filtros',
        mensaje: MENSAJE_FILTROS_INVALIDOS,
      })
    }
  })
})
