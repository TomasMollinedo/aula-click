import { describe, expect, it } from 'vitest'

import { filtrarCaracteres, tieneAlgunaLetra, tieneSoloCaracteres } from '../caracteres'

describe('filtrarCaracteres', () => {
  it('nombre: deja letras con acentos, espacios, apóstrofos y guiones', () => {
    expect(filtrarCaracteres("María José O'Connor-Pérez D’Angelo Ñandú Müller", 'nombre')).toBe(
      "María José O'Connor-Pérez D’Angelo Ñandú Müller",
    )
  })

  it('nombre: saca dígitos y símbolos', () => {
    expect(filtrarCaracteres('Ju4n_P3rez.@', 'nombre')).toBe('JunPrez')
  })

  it('nombre: conserva un acento escrito como marca combinable', () => {
    const conMarca = 'José'
    expect(filtrarCaracteres(conMarca, 'nombre')).toBe(conMarca)
  })

  it('dni: deja solo dígitos (saca letras, puntos y espacios)', () => {
    expect(filtrarCaracteres(' 30.12A3.456 ', 'dni')).toBe('30123456')
  })

  it('telefono: deja dígitos, espacios, +, - y paréntesis', () => {
    expect(filtrarCaracteres('+54 (387) 15-412-3456', 'telefono')).toBe('+54 (387) 15-412-3456')
    expect(filtrarCaracteres('387 412 ABCD', 'telefono')).toBe('387 412 ')
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
  })
})

describe('tieneAlgunaLetra', () => {
  it('pide al menos una letra', () => {
    expect(tieneAlgunaLetra("- '")).toBe(false)
    expect(tieneAlgunaLetra('Ñ')).toBe(true)
  })
})
