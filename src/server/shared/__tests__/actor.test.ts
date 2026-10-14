import { describe, expect, expectTypeOf, it } from 'vitest'
import { ForbiddenError } from '@/server/errors'
import { alumnoDeLaSesion, esRole, ROLES, type Role } from '../actor'

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

describe('alumnoDeLaSesion', () => {
  it('devuelve el alumno del actor ALUMNO', () => {
    expect(alumnoDeLaSesion({ userId: 'u-1', role: 'ALUMNO', alumnoId: 7 })).toBe(7)
  })

  it.each([
    ['un actor del personal', { userId: 'u-1', role: 'MESA_ENTRADAS' as const }],
    ['un ALUMNO sin alumno', { userId: 'u-1', role: 'ALUMNO' as const }],
  ])('con %s lanza 403 SIN_PERMISO', (_caso, actor) => {
    expect(() => alumnoDeLaSesion(actor)).toThrow(ForbiddenError)
    expect(() => alumnoDeLaSesion(actor)).toThrow(
      expect.objectContaining({ statusCode: 403, code: 'SIN_PERMISO' }),
    )
  })
})
