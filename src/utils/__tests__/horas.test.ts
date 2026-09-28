import { describe, expect, it } from 'vitest'

import { horaCorta, rangoHoras } from '../horas'

describe('horaCorta y rangoHoras', () => {
  it('saca el cero adelante de la hora, no el de los minutos', () => {
    expect(horaCorta('08:00')).toBe('8:00')
    expect(horaCorta('00:00')).toBe('0:00')
    expect(horaCorta('14:00')).toBe('14:00')
    expect(horaCorta('10:05')).toBe('10:05')
  })

  it('arma el rango', () => {
    expect(rangoHoras('08:00', '12:00')).toBe('8:00 a 12:00')
  })
})
