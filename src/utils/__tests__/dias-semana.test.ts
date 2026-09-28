import { describe, expect, it } from 'vitest'

import { DIAS_SEMANA, nombreDiaSemana } from '../dias-semana'

describe('nombreDiaSemana', () => {
  it.each([
    [1, 'Lunes'],
    [3, 'Miércoles'],
    [6, 'Sábado'],
    [7, 'Domingo'],
  ])('%i → %s (ISO: 1 = lunes, 7 = domingo)', (dia, nombre) => {
    expect(nombreDiaSemana(dia)).toBe(nombre)
  })

  it.each([0, 8, 1.5, Number.NaN])('lanza RangeError con %o', (dia) => {
    expect(() => nombreDiaSemana(dia)).toThrow(RangeError)
  })
})

describe('DIAS_SEMANA', () => {
  it('tiene los siete días en orden ISO', () => {
    expect(DIAS_SEMANA.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
