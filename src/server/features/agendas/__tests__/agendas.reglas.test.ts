import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/errors'
import {
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_MAXIMO,
  validarRangoAgenda,
} from '../agendas.reglas'

// Rango de una agenda (se movió de `turnos.reglas.test.ts` en T-30, sin cambios).

/** Ejecuta `accion`, que debe lanzar, y devuelve el error. */
function errorDe(accion: () => unknown): unknown {
  try {
    accion()
  } catch (error) {
    return error
  }
  return expect.fail('Se esperaba un error')
}

describe('validarRangoAgenda', () => {
  it('acepta un solo día y un rango del máximo de días', () => {
    expect(() => validarRangoAgenda('2026-09-28', '2026-09-28')).not.toThrow()
    // 28/09 + 30 días = 28/10: 31 días contando los dos extremos.
    expect(() => validarRangoAgenda('2026-09-28', '2026-10-28')).not.toThrow()
  })

  it('`hasta` anterior a `desde`: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoAgenda('2026-09-28', '2026-09-27'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO },
    ])
  })

  it('rango mayor al máximo: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoAgenda('2026-09-28', '2026-10-29'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_MAXIMO },
    ])
  })
})
