import { describe, expect, expectTypeOf, it } from 'vitest'
import { ESTADOS, type Estado } from '../estado'

describe('ESTADOS', () => {
  it('tiene exactamente los 2 valores de la baja lógica, en ese orden', () => {
    expect(ESTADOS).toEqual(['ACTIVO', 'INACTIVO'])
  })

  it('Estado es la unión de los 2 literales', () => {
    expectTypeOf<Estado>().toEqualTypeOf<'ACTIVO' | 'INACTIVO'>()
  })
})
