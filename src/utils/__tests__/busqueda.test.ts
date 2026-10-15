import { describe, expect, it } from 'vitest'

import { coincideConBusqueda, normalizarBusqueda } from '../busqueda'

describe('normalizarBusqueda', () => {
  it('sin tildes ni mayúsculas', () => {
    expect(normalizarBusqueda('Núñez')).toBe('nunez')
    expect(normalizarBusqueda('INGLÉS')).toBe('ingles')
  })
})

describe('coincideConBusqueda', () => {
  it('una búsqueda vacía o de espacios coincide con todo', () => {
    expect(coincideConBusqueda('Matemática', '')).toBe(true)
    expect(coincideConBusqueda('Matemática', '   ')).toBe(true)
  })

  it('en forma parcial, sin tildes ni mayúsculas', () => {
    expect(coincideConBusqueda('Inglés', 'INGLES')).toBe(true)
    expect(coincideConBusqueda('Núñez', 'nun')).toBe(true)
  })

  it('todas las palabras, en cualquier orden', () => {
    expect(coincideConBusqueda('Física Cuántica', 'cuant fis')).toBe(true)
    expect(coincideConBusqueda('Física Cuántica', 'cuant quimica')).toBe(false)
  })
})
