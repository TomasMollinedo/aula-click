import { describe, expect, it } from 'vitest'
import { partirEnHoras } from '../bloques.reglas'

describe('partirEnHoras', () => {
  it('una hora exacta da un solo tramo', () => {
    expect(partirEnHoras('14:00', '15:00')).toEqual([{ horaInicio: 840, horaFin: 900 }])
  })

  it('un rango de varias horas da un tramo por cada una', () => {
    expect(partirEnHoras('14:00', '18:00')).toEqual([
      { horaInicio: 840, horaFin: 900 },
      { horaInicio: 900, horaFin: 960 },
      { horaInicio: 960, horaFin: 1020 },
      { horaInicio: 1020, horaFin: 1080 },
    ])
  })

  it('un rango que empieza a medianoche', () => {
    expect(partirEnHoras('00:00', '02:00')).toEqual([
      { horaInicio: 0, horaFin: 60 },
      { horaInicio: 60, horaFin: 120 },
    ])
  })
})
