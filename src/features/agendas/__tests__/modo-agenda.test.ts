import { describe, expect, it } from 'vitest'

import { claveModoAgenda, MODO_POR_DEFECTO, parsearModo } from '../modo-agenda'

describe('claveModoAgenda', () => {
  it('es distinta para cada usuario', () => {
    expect(claveModoAgenda('u1')).not.toBe(claveModoAgenda('u2'))
  })
})

describe('parsearModo', () => {
  it.each(['calendario', 'lista'] as const)('acepta %s', (modo) => {
    expect(parsearModo(modo)).toBe(modo)
  })

  it.each([null, undefined, '', 'semana', 'CALENDARIO'])('%s es el modo por defecto', (valor) => {
    expect(parsearModo(valor)).toBe(MODO_POR_DEFECTO)
  })

  it('el modo por defecto es la lista, como antes del calendario', () => {
    expect(MODO_POR_DEFECTO).toBe('lista')
  })
})
