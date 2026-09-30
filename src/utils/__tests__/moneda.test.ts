import { describe, expect, it } from 'vitest'

import { formatearPesos } from '../moneda'

// Intl separa el `$` del número con un espacio duro (U+00A0).
const NBSP = ' '

describe('formatearPesos', () => {
  it('entero: separador de miles con punto y dos decimales', () => {
    expect(formatearPesos(7500)).toBe(`$${NBSP}7.500,00`)
  })

  it('completa a dos decimales', () => {
    expect(formatearPesos(8000.5)).toBe(`$${NBSP}8.000,50`)
    expect(formatearPesos(8000.25)).toBe(`$${NBSP}8.000,25`)
  })

  it('menos de mil: sin separador de miles', () => {
    expect(formatearPesos(0.5)).toBe(`$${NBSP}0,50`)
    expect(formatearPesos(999)).toBe(`$${NBSP}999,00`)
  })

  it('el tope de la API', () => {
    expect(formatearPesos(99999999.99)).toBe(`$${NBSP}99.999.999,99`)
  })
})
