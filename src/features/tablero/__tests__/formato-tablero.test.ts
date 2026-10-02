import { describe, expect, it } from 'vitest'

import {
  anchoDeBarra,
  formatearCantidad,
  formatearPorcentaje,
  rotuloALaFecha,
  rotuloDelPeriodo,
  textoPeriodo,
  textoTurnos,
} from '../formato-tablero'

describe('formatearPorcentaje', () => {
  it('coma decimal y sin ceros de más', () => {
    expect(formatearPorcentaje(33.3)).toBe('33,3 %')
    expect(formatearPorcentaje(12.5)).toBe('12,5 %')
    expect(formatearPorcentaje(50)).toBe('50 %')
    expect(formatearPorcentaje(0)).toBe('0 %')
  })

  it('no se recorta a 100', () => {
    expect(formatearPorcentaje(112.5)).toBe('112,5 %')
  })
})

describe('formatearCantidad', () => {
  it('separador de miles de es-AR', () => {
    expect(formatearCantidad(0)).toBe('0')
    expect(formatearCantidad(48)).toBe('48')
    expect(formatearCantidad(1234)).toBe('1.234')
  })
})

describe('textoPeriodo', () => {
  it('un solo día', () => {
    expect(textoPeriodo('2026-10-02', '2026-10-02')).toBe('02/10/2026')
  })

  it('el mismo año: el año solo al final', () => {
    expect(textoPeriodo('2026-09-28', '2026-10-04')).toBe('28/09 al 04/10/2026')
  })

  it('años distintos: el año en los dos extremos', () => {
    expect(textoPeriodo('2026-12-28', '2027-01-03')).toBe('28/12/2026 al 03/01/2027')
  })
})

describe('rótulos', () => {
  it('el período de la respuesta', () => {
    expect(rotuloDelPeriodo({ desde: '2026-09-28', hasta: '2026-10-04' })).toBe(
      'Período: 28/09 al 04/10/2026',
    )
  })

  it('el total adeudado es a la fecha, no del período', () => {
    expect(rotuloALaFecha('2026-10-02')).toBe('A la fecha: 02/10/2026')
  })
})

describe('anchoDeBarra', () => {
  it('es relativo a la materia con más turnos', () => {
    expect(anchoDeBarra(15, 15)).toBe(100)
    expect(anchoDeBarra(9, 15)).toBe(60)
    expect(anchoDeBarra(4, 15)).toBe(27)
  })

  it('sin máximo, 0', () => {
    expect(anchoDeBarra(0, 0)).toBe(0)
  })
})

describe('textoTurnos', () => {
  it('singular y plural', () => {
    expect(textoTurnos(1)).toBe('1 turno')
    expect(textoTurnos(15)).toBe('15 turnos')
  })
})
