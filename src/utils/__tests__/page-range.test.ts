import { describe, expect, it } from 'vitest'

import { getPageRange } from '../page-range'

describe('getPageRange', () => {
  it('sin páginas devuelve una lista vacía', () => {
    expect(getPageRange(1, 0)).toEqual([])
  })

  it('con pocas páginas las muestra todas', () => {
    expect(getPageRange(1, 1)).toEqual([1])
    expect(getPageRange(2, 4)).toEqual([1, 2, 3, 4])
    expect(getPageRange(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('al principio muestra las tres primeras y la última', () => {
    expect(getPageRange(1, 6)).toEqual([1, 2, 3, 'ellipsis', 6])
    expect(getPageRange(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
  })

  it('al final muestra la primera y las tres últimas', () => {
    expect(getPageRange(10, 10)).toEqual([1, 'ellipsis', 8, 9, 10])
  })

  it('en el medio muestra la actual con sus vecinas y los extremos', () => {
    expect(getPageRange(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
  })

  it('completa un hueco de una sola página en lugar de poner puntos suspensivos', () => {
    expect(getPageRange(4, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10])
  })

  it('acota una página fuera de rango', () => {
    expect(getPageRange(99, 3)).toEqual([1, 2, 3])
    expect(getPageRange(0, 3)).toEqual([1, 2, 3])
  })
})
