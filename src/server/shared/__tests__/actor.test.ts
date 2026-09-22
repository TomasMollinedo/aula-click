import { describe, expect, expectTypeOf, it } from 'vitest'
import { esRole, ROLES, type Role } from '../actor'

describe('ROLES', () => {
  it('tiene exactamente los 4 roles del contrato, en ese orden', () => {
    expect(ROLES).toEqual(['MESA_ENTRADAS', 'PROFESOR', 'GERENTE', 'ALUMNO'])
  })

  it('Role es la unión de los 4 literales', () => {
    expectTypeOf<Role>().toEqualTypeOf<'MESA_ENTRADAS' | 'PROFESOR' | 'GERENTE' | 'ALUMNO'>()
  })
})

describe('esRole', () => {
  it.each(ROLES)('%s es un rol', (rol) => {
    expect(esRole(rol)).toBe(true)
  })

  it.each([['mesa_entradas'], [''], ['ADMIN'], [null], [undefined], [1], [{}]])(
    '%o no es un rol',
    (valor) => {
      expect(esRole(valor)).toBe(false)
    },
  )

  it('estrecha un unknown a Role', () => {
    expectTypeOf(esRole).guards.toEqualTypeOf<Role>()
    const valor: unknown = 'GERENTE'
    if (esRole(valor)) expectTypeOf(valor).toEqualTypeOf<Role>()
  })
})
