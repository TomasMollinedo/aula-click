import { describe, expect, it } from 'vitest'

import {
  textoCantidadTurnos,
  textoFechaPago,
  textoImporte,
  textoOcurrencia,
  textoSeleccion,
} from '../formato-cuentas'
import { ADEUDADOS, CUENTA } from './fixtures'

// Intl separa el `$` del número con un espacio duro (U+00A0).
const NBSP = ' '

describe('textoSeleccion', () => {
  it('singular', () => {
    expect(textoSeleccion({ cantidad: 1, total: 8000 })).toBe(
      `1 turno seleccionado · $${NBSP}8.000,00`,
    )
  })

  it('plural', () => {
    expect(textoSeleccion({ cantidad: 4, total: 32000 })).toBe(
      `4 turnos seleccionados · $${NBSP}32.000,00`,
    )
  })

  it('con decimales', () => {
    expect(textoSeleccion({ cantidad: 1, total: 9000.5 })).toBe(
      `1 turno seleccionado · $${NBSP}9.000,50`,
    )
  })

  it('sin total (alguno sin precio)', () => {
    expect(textoSeleccion({ cantidad: 3, total: null })).toBe(
      '3 turnos seleccionados · total sin calcular',
    )
  })
})

describe('textoImporte', () => {
  it('con precio y sin precio', () => {
    expect(textoImporte(9000.5)).toBe(`$${NBSP}9.000,50`)
    expect(textoImporte(null)).toBe('Sin precio')
  })
})

describe('textoFechaPago', () => {
  it('dd/MM/yyyy', () => {
    expect(textoFechaPago('2026-10-01')).toBe('01/10/2026')
  })
})

describe('textoOcurrencia', () => {
  it('fecha con día, horario y materia', () => {
    expect(textoOcurrencia(CUENTA.proximos[0])).toBe('lunes 05/10 de 9:00 a 10:00, Matemática')
  })

  it('con el alumno, solo si se pide y la fila lo trae', () => {
    const fila = ADEUDADOS.data[0]
    expect(textoOcurrencia(fila, true)).toBe(
      'Lucía Álvarez, lunes 21/09 de 9:00 a 10:00, Matemática',
    )
    expect(textoOcurrencia(fila)).toBe('lunes 21/09 de 9:00 a 10:00, Matemática')
    expect(textoOcurrencia(CUENTA.adeudados[0], true)).toBe(
      'lunes 21/09 de 9:00 a 10:00, Matemática',
    )
  })
})

describe('textoCantidadTurnos', () => {
  it('singular y plural', () => {
    expect(textoCantidadTurnos(1)).toBe('1 turno')
    expect(textoCantidadTurnos(4)).toBe('4 turnos')
  })
})
