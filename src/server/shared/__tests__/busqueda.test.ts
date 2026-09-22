import { describe, expect, it } from 'vitest'
import { normalizarBusqueda } from '../busqueda'

describe('normalizarBusqueda', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizarBusqueda('González')).toBe('gonzalez')
  })

  it('quita la virgulilla de la ñ y colapsa y recorta espacios', () => {
    expect(normalizarBusqueda('  Ñandú  Pérez ')).toBe('nandu perez')
  })

  it('hace chocar "Matemática" con "matematica"', () => {
    expect(normalizarBusqueda('Matemática')).toBe(normalizarBusqueda('matematica'))
  })
})
