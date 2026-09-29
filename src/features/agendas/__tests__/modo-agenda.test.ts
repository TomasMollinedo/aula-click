import { describe, expect, it } from 'vitest'

import { MODO_POR_DEFECTO, paramsConModo, parsearModo } from '../modo-agenda'

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

describe('paramsConModo', () => {
  it('escribe el calendario y conserva los demás parámetros', () => {
    const params = paramsConModo(new URLSearchParams('fecha=2026-09-29&tab=agenda'), 'calendario')
    expect(params.toString()).toBe('fecha=2026-09-29&tab=agenda&modo=calendario')
  })

  it('no escribe el modo por defecto y saca el que había', () => {
    const params = paramsConModo(new URLSearchParams('modo=calendario&fecha=2026-09-29'), 'lista')
    expect(params.toString()).toBe('fecha=2026-09-29')
  })
})
