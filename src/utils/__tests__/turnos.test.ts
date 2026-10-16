import { describe, expect, it } from 'vitest'

import { textoCantidadDeTurnos } from '../turnos'

describe('textoCantidadDeTurnos', () => {
  it('singular y plural', () => {
    expect(textoCantidadDeTurnos(1)).toBe('1 turno')
    expect(textoCantidadDeTurnos(0)).toBe('0 turnos')
    expect(textoCantidadDeTurnos(8)).toBe('8 turnos')
  })
})
