import { describe, expect, it } from 'vitest'

import { getInitials } from '../initials'

describe('getInitials', () => {
  it('toma la primera letra de cada parte, en mayúsculas', () => {
    expect(getInitials('camila', 'ríos')).toBe('CR')
  })

  it('ignora las partes vacías o nulas', () => {
    expect(getInitials('Julieta', null, '  ', undefined)).toBe('J')
    expect(getInitials()).toBe('')
  })

  it('devuelve como máximo dos letras', () => {
    expect(getInitials('Ana', 'María', 'Pérez')).toBe('AM')
  })
})
