import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  MENSAJE_PERIODO_INVALIDO,
  interpretarErrorTablero,
  mensajesDeAsistencia,
  mensajesDeFinanzas,
} from '../errores-tablero'

const api = (status: number, details?: unknown) =>
  new ApiError(status, 'CODIGO', 'mensaje de la API', details)

describe('interpretarErrorTablero', () => {
  it('400: el mensaje de la API va junto a "Hasta" y no queda error general', () => {
    const error = interpretarErrorTablero(
      api(400, [
        {
          code: 'custom',
          path: ['hasta'],
          message: 'La fecha hasta no puede ser anterior a la fecha desde',
        },
      ]),
    )
    expect(error).toEqual({
      tipo: 'periodo',
      mensaje: null,
      campos: { hasta: 'La fecha hasta no puede ser anterior a la fecha desde' },
      reintentar: false,
    })
  })

  it('400: un detalle sobre "desde" va junto a "Desde"', () => {
    const error = interpretarErrorTablero(
      api(400, [{ path: ['desde'], message: 'Fecha inválida' }]),
    )
    expect(error.campos).toEqual({ desde: 'Fecha inválida' })
    expect(error.mensaje).toBeNull()
  })

  it('400: queda el primer mensaje de cada campo', () => {
    const error = interpretarErrorTablero(
      api(400, [
        { path: ['hasta'], message: 'Primero' },
        { path: ['hasta'], message: 'Segundo' },
      ]),
    )
    expect(error.campos).toEqual({ hasta: 'Primero' })
  })

  it('400 sin details o con uno que no se puede ubicar: error general', () => {
    for (const details of [undefined, [], [{ path: ['otro'], message: 'x' }], 'texto']) {
      const error = interpretarErrorTablero(api(400, details))
      expect(error.tipo).toBe('periodo')
      expect(error.mensaje).toBe(MENSAJE_PERIODO_INVALIDO)
      expect(error.reintentar).toBe(false)
    }
  })

  it('400 con un campo ubicado y otro no: además queda el error general', () => {
    const error = interpretarErrorTablero(
      api(400, [
        { path: ['hasta'], message: 'Ubicado' },
        { path: ['otro'], message: 'Sin ubicar' },
      ]),
    )
    expect(error.campos).toEqual({ hasta: 'Ubicado' })
    expect(error.mensaje).toBe(MENSAJE_PERIODO_INVALIDO)
  })

  it('403: sin permiso y sin reintentar', () => {
    expect(interpretarErrorTablero(api(403))).toEqual({
      tipo: 'sinPermiso',
      mensaje: 'No tenés permiso para ver el tablero',
      campos: {},
      reintentar: false,
    })
  })

  it('500, error de red o desconocido: genérico, con reintentar', () => {
    for (const error of [api(500), new TypeError('Failed to fetch') as never, null, undefined]) {
      const interpretado = interpretarErrorTablero(error)
      expect(interpretado.tipo).toBe('general')
      expect(interpretado.reintentar).toBe(true)
    }
  })
})

describe('400 de los parámetros de "Asistencia"', () => {
  it('un detalle sobre una página, el orden o el filtro no invalida el período', () => {
    const error = interpretarErrorTablero(
      api(400, [{ code: 'custom', path: ['orden'], message: 'Orden inválido' }]),
    )

    expect(error).toEqual({
      tipo: 'parametros',
      mensaje: null,
      campos: { orden: 'Orden inválido' },
      reintentar: false,
    })
    expect(mensajesDeAsistencia(error)).toEqual(['Orden inválido'])
  })

  it('ubica cada campo de las tablas, en el orden en que se muestran', () => {
    const error = interpretarErrorTablero(
      api(400, [
        { path: ['soloSinRegistrar'], message: 'Debe ser true o false' },
        { path: ['paginaProfesores'], message: 'Debe ser mayor a 0' },
        { path: ['direccion'], message: 'Dirección inválida' },
      ]),
    )

    expect(error.tipo).toBe('parametros')
    expect(error.campos).toEqual({
      soloSinRegistrar: 'Debe ser true o false',
      paginaProfesores: 'Debe ser mayor a 0',
      direccion: 'Dirección inválida',
    })
    expect(mensajesDeAsistencia(error)).toEqual([
      'Debe ser mayor a 0',
      'Dirección inválida',
      'Debe ser true o false',
    ])
  })

  it('si además toca el período, manda el período (el documento no se puede armar)', () => {
    const error = interpretarErrorTablero(
      api(400, [
        { path: ['hasta'], message: 'La fecha hasta no puede ser anterior a la fecha desde' },
        { path: ['paginaMaterias'], message: 'Debe ser mayor a 0' },
      ]),
    )

    expect(error.tipo).toBe('periodo')
    expect(error.campos.hasta).toBe('La fecha hasta no puede ser anterior a la fecha desde')
    expect(mensajesDeAsistencia(error)).toEqual(['Debe ser mayor a 0'])
  })

  it('un campo desconocido deja el error general del período', () => {
    const error = interpretarErrorTablero(api(400, [{ path: ['pagina'], message: 'Inválido' }]))

    expect(error.tipo).toBe('periodo')
    expect(error.mensaje).toBe(MENSAJE_PERIODO_INVALIDO)
    expect(mensajesDeAsistencia(error)).toEqual([])
  })

  it('sin error, o con uno que no es un 400, no hay mensajes de las tablas', () => {
    expect(mensajesDeAsistencia(null)).toEqual([])
    expect(mensajesDeAsistencia(interpretarErrorTablero(api(403)))).toEqual([])
  })
})

describe('400 de los parámetros de "Finanzas"', () => {
  it('un detalle sobre la página o el orden no invalida el período', () => {
    const error = interpretarErrorTablero(
      api(400, [
        { path: ['page'], message: 'Debe ser mayor a 0' },
        { path: ['orden'], message: 'Orden inválido' },
      ]),
    )

    expect(error.tipo).toBe('parametros')
    expect(error.mensaje).toBeNull()
    expect(mensajesDeFinanzas(error)).toEqual(['Debe ser mayor a 0', 'Orden inválido'])
  })

  it('`orden` y `direccion` los comparten las dos secciones', () => {
    const error = interpretarErrorTablero(api(400, [{ path: ['direccion'], message: 'Inválida' }]))

    expect(mensajesDeFinanzas(error)).toEqual(['Inválida'])
    expect(mensajesDeAsistencia(error)).toEqual(['Inválida'])
  })

  it('la página de "Finanzas" no sale en los mensajes de "Asistencia"', () => {
    const error = interpretarErrorTablero(api(400, [{ path: ['page'], message: 'Inválida' }]))

    expect(mensajesDeAsistencia(error)).toEqual([])
    expect(mensajesDeFinanzas(error)).toEqual(['Inválida'])
  })

  it('sin error, o con uno que no es un 400, no hay mensajes de la tabla', () => {
    expect(mensajesDeFinanzas(null)).toEqual([])
    expect(mensajesDeFinanzas(interpretarErrorTablero(api(403)))).toEqual([])
  })
})
