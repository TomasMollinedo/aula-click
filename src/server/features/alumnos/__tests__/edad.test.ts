import { describe, expect, it } from 'vitest'
import { esMenorDeEdad } from '../edad'

describe('esMenorDeEdad', () => {
  it('el día exacto en que cumple 18 ya es mayor', () => {
    expect(esMenorDeEdad('2008-09-22', '2026-09-22')).toBe(false)
  })

  it('el día anterior a cumplir 18 es menor', () => {
    expect(esMenorDeEdad('2008-09-22', '2026-09-21')).toBe(true)
  })

  it('con más de 18 es mayor y con menos es menor', () => {
    expect(esMenorDeEdad('1990-05-14', '2026-09-22')).toBe(false)
    expect(esMenorDeEdad('2012-03-08', '2026-09-22')).toBe(true)
  })

  // Un año bisiesto + 18 nunca es bisiesto (18 no es múltiplo de 4): quien nace un 29 de febrero
  // cumple 18 en un año sin 29 de febrero.
  it('nacido el 29 de febrero de un año bisiesto, cumple 18 el 1 de marzo', () => {
    expect(esMenorDeEdad('2008-02-29', '2026-02-28')).toBe(true)
    expect(esMenorDeEdad('2008-02-29', '2026-03-01')).toBe(false)
  })

  it('nacido el 28 de febrero de un año no bisiesto, cumple 18 el 28 de febrero', () => {
    expect(esMenorDeEdad('2007-02-28', '2025-02-27')).toBe(true)
    expect(esMenorDeEdad('2007-02-28', '2025-02-28')).toBe(false)
  })
})
