import { describe, expect, it } from 'vitest'

import { formatearPesos, subtotalesPorMateria, sumarImportes } from '../moneda'

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

  it('millones con centavos', () => {
    expect(formatearPesos(1234567.05)).toBe(`$${NBSP}1.234.567,05`)
  })

  it('redondea a centavos sin arrastrar el error de coma flotante', () => {
    expect(formatearPesos(0.1 + 0.2)).toBe(`$${NBSP}0,30`)
  })

  it('el tope de la API', () => {
    expect(formatearPesos(99999999.99)).toBe(`$${NBSP}99.999.999,99`)
  })
})

describe('sumarImportes', () => {
  it('suma en centavos, sin arrastrar el error de coma flotante', () => {
    expect(sumarImportes([0.1, 0.2])).toEqual({ total: 0.3, sinPrecio: 0 })
    expect(sumarImportes([8000, 8000, 9500.25])).toEqual({ total: 25500.25, sinPrecio: 0 })
    expect(sumarImportes([9000.5, 9000.5])).toEqual({ total: 18001, sinPrecio: 0 })
  })

  it('con algún null no hay total, y cuenta cuántos no tienen precio', () => {
    expect(sumarImportes([8000, null, null])).toEqual({ total: null, sinPrecio: 2 })
    expect(sumarImportes([null])).toEqual({ total: null, sinPrecio: 1 })
  })

  it('sin importes: total 0', () => {
    expect(sumarImportes([])).toEqual({ total: 0, sinPrecio: 0 })
  })
})

describe('subtotalesPorMateria', () => {
  const MATEMATICA = { id: 2, nombre: 'Matemática' }
  const INGLES = { id: 5, nombre: 'Inglés' }

  it('una entrada por materia, por nombre, con su cantidad y subtotal en centavos', () => {
    expect(
      subtotalesPorMateria([
        { materia: MATEMATICA, importe: 8000 },
        { materia: INGLES, importe: 9000 },
        { materia: MATEMATICA, importe: 8000.5 },
      ]),
    ).toEqual([
      { materia: INGLES, cantidad: 1, total: 9000 },
      { materia: MATEMATICA, cantidad: 2, total: 16000.5 },
    ])
  })

  it('una materia con un importe sin precio queda sin subtotal', () => {
    expect(
      subtotalesPorMateria([
        { materia: MATEMATICA, importe: 8000 },
        { materia: MATEMATICA, importe: null },
      ]),
    ).toEqual([{ materia: MATEMATICA, cantidad: 2, total: null }])
  })

  it('acepta cualquier iterable (los valores de un Map) y, vacío, no tiene materias', () => {
    const seleccion = new Map([['41|2026-09-21', { materia: INGLES, importe: 9000, extra: true }]])
    expect(subtotalesPorMateria(seleccion.values())).toEqual([
      { materia: INGLES, cantidad: 1, total: 9000 },
    ])
    expect(subtotalesPorMateria([])).toEqual([])
  })
})
