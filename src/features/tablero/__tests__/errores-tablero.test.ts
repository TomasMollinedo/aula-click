import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { MENSAJE_PERIODO_INVALIDO, interpretarErrorTablero } from '../errores-tablero'

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
