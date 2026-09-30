import { describe, expect, it } from 'vitest'

import { textoCantidadTurnos, textoSeleccion } from '../formato-cuentas'

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

describe('textoCantidadTurnos', () => {
  it('singular y plural', () => {
    expect(textoCantidadTurnos(1)).toBe('1 turno')
    expect(textoCantidadTurnos(4)).toBe('4 turnos')
  })
})
