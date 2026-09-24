import { describe, expect, it } from 'vitest'

import { filtrarCaracteres, tieneAlgunaLetra, tieneSoloCaracteres } from '../caracteres'

describe('filtrarCaracteres', () => {
  it('nombre: deja letras con acentos y espacios', () => {
    expect(filtrarCaracteres('María José Pérez Ñandú Müller', 'nombre')).toBe(
      'María José Pérez Ñandú Müller',
    )
  })

  it('nombre: saca dígitos y símbolos, también guiones y apóstrofos', () => {
    expect(filtrarCaracteres('Ju4n_P3rez.@', 'nombre')).toBe('JunPrez')
    expect(filtrarCaracteres("O'Connor-Pérez D’Angelo", 'nombre')).toBe('OConnorPérez DAngelo')
  })

  it('nombre: conserva un acento escrito como marca combinable', () => {
    const conMarca = 'José'
    expect(filtrarCaracteres(conMarca, 'nombre')).toBe(conMarca)
  })

  it('dni: deja solo dígitos (saca letras, puntos y espacios)', () => {
    expect(filtrarCaracteres(' 30.12A3.456 ', 'dni')).toBe('30123456')
  })

  it('telefono: deja solo dígitos (saca +, -, espacios, paréntesis y letras)', () => {
    expect(filtrarCaracteres('+54 (387) 15-412-3456', 'telefono')).toBe('54387154123456')
    expect(filtrarCaracteres('387 412 ABCD', 'telefono')).toBe('387412')
  })
})

describe('tieneSoloCaracteres', () => {
  it('es true si no hay nada que filtrar, incluso con un texto vacío', () => {
    expect(tieneSoloCaracteres('Lucía', 'nombre')).toBe(true)
    expect(tieneSoloCaracteres('', 'dni')).toBe(true)
  })

  it('es false con un carácter no permitido', () => {
    expect(tieneSoloCaracteres('Lucía2', 'nombre')).toBe(false)
    expect(tieneSoloCaracteres('3012345A', 'dni')).toBe(false)
    expect(tieneSoloCaracteres('Pérez-Gil', 'nombre')).toBe(false)
    expect(tieneSoloCaracteres('387-4123456', 'telefono')).toBe(false)
  })
})

describe('tieneAlgunaLetra', () => {
  it('pide al menos una letra', () => {
    expect(tieneAlgunaLetra('   ')).toBe(false)
    expect(tieneAlgunaLetra('Ñ')).toBe(true)
  })
})
