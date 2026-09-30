import { describe, expect, it } from 'vitest'

import { formatearPesos } from '../moneda'

describe('formatearPesos', () => {
  it('mismos casos que el test del backend (pagos.reglas.test.ts)', () => {
    expect(formatearPesos(30000)).toBe('$ 30.000')
    expect(formatearPesos(32000)).toBe('$ 32.000')
    expect(formatearPesos(30000.5)).toBe('$ 30.000,50')
    expect(formatearPesos(999)).toBe('$ 999')
    expect(formatearPesos(1234567.05)).toBe('$ 1.234.567,05')
  })

  it('cero y un importe sin miles', () => {
    expect(formatearPesos(0)).toBe('$ 0')
    expect(formatearPesos(1000)).toBe('$ 1.000')
    expect(formatearPesos(0.5)).toBe('$ 0,50')
  })

  it('redondea a centavos sin arrastrar el error de coma flotante', () => {
    expect(formatearPesos(0.1 + 0.2)).toBe('$ 0,30')
    expect(formatearPesos(99999999.99)).toBe('$ 99.999.999,99')
  })
})
