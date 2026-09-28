import { describe, expect, it } from 'vitest'

import { esMenorDeEdad } from '../edad'

describe('esMenorDeEdad', () => {
  it('es menor el día anterior a cumplir 18', () => {
    expect(esMenorDeEdad('2008-09-24', '2026-09-23')).toBe(true)
  })

  it('el día que cumple 18 ya es mayor', () => {
    expect(esMenorDeEdad('2008-09-23', '2026-09-23')).toBe(false)
  })

  it('con más de 18 es mayor', () => {
    expect(esMenorDeEdad('1990-01-01', '2026-09-23')).toBe(false)
  })

  it('quien nació un 29 de febrero pasa a ser mayor el 1 de marzo', () => {
    expect(esMenorDeEdad('2008-02-29', '2026-02-28')).toBe(true)
    expect(esMenorDeEdad('2008-02-29', '2026-03-01')).toBe(false)
  })

  it('con la fecha incompleta o vacía no decide', () => {
    expect(esMenorDeEdad('', '2026-09-23')).toBeNull()
    expect(esMenorDeEdad('2008-09', '2026-09-23')).toBeNull()
  })
})
