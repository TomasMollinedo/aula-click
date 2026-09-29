import { describe, expect, it } from 'vitest'

import { fechaConDia, fechaCorta } from '../formato-fechas'

describe('fechaCorta y fechaConDia', () => {
  it('muestra el día de la fecha, no el anterior (el bug de new Date en UTC−3)', () => {
    expect(fechaCorta('2026-10-12')).toBe('12/10')
    expect(fechaConDia('2026-10-12')).toBe('lunes 12/10')
  })

  it('cruce de mes', () => {
    expect(fechaConDia('2026-10-31')).toBe('sábado 31/10')
    expect(fechaConDia('2026-11-01')).toBe('domingo 01/11')
  })

  it('cruce de año', () => {
    expect(fechaConDia('2026-12-31')).toBe('jueves 31/12')
    expect(fechaConDia('2027-01-01')).toBe('viernes 01/01')
  })
})
