import { describe, expect, it } from 'vitest'

import {
  fechaConDia,
  avisoHoraCompleta,
  etiquetaOcupacion,
  fechaCorta,
  lineasFechasSinTurno,
  textoHorario,
  textoRangoPedido,
  textoRangoTurno,
} from '../formato-turnos'

describe('textoHorario', () => {
  it('"de 8:00 a 12:00"', () => {
    expect(textoHorario('08:00', '12:00')).toBe('de 8:00 a 12:00')
  })
})

describe('fechaCorta y fechaConDia', () => {
  it('muestra el día de la fecha, no el anterior (el bug de new Date en UTC−3)', () => {
    expect(fechaCorta('2026-10-12')).toBe('12/10')
    expect(fechaConDia('2026-10-12')).toBe('lunes 12/10')
  })

  it('cruce de mes', () => {
    expect(fechaConDia('2026-10-31')).toBe('sábado 31/10')
    expect(fechaConDia('2026-11-01')).toBe('domingo 01/11')
  })

  it('cruce de año', () => {
    expect(fechaConDia('2026-12-31')).toBe('jueves 31/12')
    expect(fechaConDia('2027-01-01')).toBe('viernes 01/01')
  })
})

describe('textoRangoTurno', () => {
  it('sesión única', () => {
    expect(
      textoRangoTurno({ tipo: 'SESION_UNICA', fechaInicio: '2026-10-12', fechaFin: '2026-10-12' }),
    ).toBe('sesión única del 12/10')
  })

  it('recurrente con fin', () => {
    expect(
      textoRangoTurno({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '2026-11-30' }),
    ).toBe('recurrente del 05/10 al 30/11')
  })

  it('recurrente sin fin', () => {
    expect(textoRangoTurno({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: null })).toBe(
      'recurrente desde el 05/10, sin fin',
    )
  })
})

describe('lineasFechasSinTurno', () => {
  it('una fecha (ejemplo del alta en tramos)', () => {
    expect(
      lineasFechasSinTurno([
        {
          bloqueId: 11,
          horaInicio: '09:00',
          horaFin: '10:00',
          fechas: ['2026-10-26'],
          completoDesde: null,
        },
      ]),
    ).toEqual(['De 9:00 a 10:00: lunes 26/10'])
  })

  it('varias fechas y completoDesde', () => {
    expect(
      lineasFechasSinTurno([
        {
          bloqueId: 11,
          horaInicio: '09:00',
          horaFin: '10:00',
          fechas: ['2026-10-12', '2026-10-19'],
          completoDesde: '2026-11-02',
        },
      ]),
    ).toEqual(['De 9:00 a 10:00: lunes 12/10, lunes 19/10 y desde el lunes 02/11 en adelante'])
  })

  it('solo completoDesde', () => {
    expect(
      lineasFechasSinTurno([
        {
          bloqueId: 10,
          horaInicio: '08:00',
          horaFin: '09:00',
          fechas: [],
          completoDesde: '2026-12-28',
        },
      ]),
    ).toEqual(['De 8:00 a 9:00: desde el lunes 28/12 en adelante'])
  })

  it('sin fechas: no hay línea', () => {
    expect(lineasFechasSinTurno([])).toEqual([])
    expect(
      lineasFechasSinTurno([
        { bloqueId: 10, horaInicio: '08:00', horaFin: '09:00', fechas: [], completoDesde: null },
      ]),
    ).toEqual([])
  })
})

describe('etiquetaOcupacion', () => {
  it('con la fecha del resultado', () => {
    expect(etiquetaOcupacion('2026-09-28')).toBe('Ocupación del lunes 28/09')
    expect(etiquetaOcupacion('2026-10-05')).toBe('Ocupación del lunes 05/10')
  })
})

describe('textoRangoPedido', () => {
  it('sesión única', () => {
    expect(textoRangoPedido({ tipo: 'SESION_UNICA', fechaInicio: '2026-10-12' })).toBe('el 12/10')
  })

  it('recurrente con y sin fin', () => {
    expect(
      textoRangoPedido({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '2026-11-30' }),
    ).toBe('desde el 05/10 hasta el 30/11')
    expect(
      textoRangoPedido({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: null }),
    ).toBe('desde el 05/10, sin fecha de fin')
  })
})

describe('avisoHoraCompleta', () => {
  it('con la hora y la fecha de la ocupación', () => {
    expect(avisoHoraCompleta({ horaInicio: '09:00', horaFin: '10:00' }, '2026-10-05')).toBe(
      'La hora de 9:00 a 10:00 está completa el lunes 05/10',
    )
  })
})
