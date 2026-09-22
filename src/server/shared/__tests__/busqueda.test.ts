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

  it('quita la diéresis', () => {
    expect(normalizarBusqueda('Güemes')).toBe('guemes')
  })

  it('devuelve "" con un texto vacío', () => {
    expect(normalizarBusqueda('')).toBe('')
  })

  it('no altera un DNI con puntos salvo los espacios', () => {
    expect(normalizarBusqueda('30.123.456')).toBe('30.123.456')
    expect(normalizarBusqueda(' 30.123.456 ')).toBe('30.123.456')
  })

  it.each(['González', '  Ñandú  Pérez ', 'Güemes', 'ya normalizado'])(
    'es idempotente (%o)',
    (texto) => {
      const normalizado = normalizarBusqueda(texto)
      expect(normalizarBusqueda(normalizado)).toBe(normalizado)
    },
  )
})
