import { describe, expect, it } from 'vitest'

import { formatearPorcentaje } from '../porcentaje'

// Entre el número y el `%` va un espacio duro (U+00A0).
const NBSP = ' '

describe('formatearPorcentaje', () => {
  it('entero: sin decimales', () => {
    expect(formatearPorcentaje(15)).toBe(`15${NBSP}%`)
    expect(formatearPorcentaje(0)).toBe(`0${NBSP}%`)
  })

  it('con decimales: coma decimal, hasta dos', () => {
    expect(formatearPorcentaje(15.5)).toBe(`15,5${NBSP}%`)
    expect(formatearPorcentaje(15.25)).toBe(`15,25${NBSP}%`)
  })

  it('sin ceros de más (15.50 no muestra "15,50")', () => {
    expect(formatearPorcentaje(Number('15.50'))).toBe(`15,5${NBSP}%`)
    expect(formatearPorcentaje(Number('15.00'))).toBe(`15${NBSP}%`)
  })

  it('redondea a dos decimales sin arrastrar el error de coma flotante', () => {
    expect(formatearPorcentaje(0.155 * 100)).toBe(`15,5${NBSP}%`)
  })

  it('el tope de la API', () => {
    expect(formatearPorcentaje(99.99)).toBe(`99,99${NBSP}%`)
  })
})
