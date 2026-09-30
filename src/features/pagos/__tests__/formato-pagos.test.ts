import { describe, expect, it } from 'vitest'

import { textoCantidad, textoConfirmacion, textoExito, textoVuelto } from '../formato-pagos'

describe('textoCantidad', () => {
  it('singular y plural', () => {
    expect(textoCantidad(1)).toBe('1 turno')
    expect(textoCantidad(4)).toBe('4 turnos')
  })
})

describe('textoConfirmacion', () => {
  it('con total', () => {
    expect(textoConfirmacion({ cantidad: 4, total: 32000 })).toBe(
      '¿Registrar el pago de 4 turnos por $ 32.000 en efectivo?',
    )
    expect(textoConfirmacion({ cantidad: 1, total: 8000.5 })).toBe(
      '¿Registrar el pago de 1 turno por $ 8.000,50 en efectivo?',
    )
  })

  it('sin total (alguno sin precio)', () => {
    expect(textoConfirmacion({ cantidad: 4, total: null })).toBe(
      '¿Registrar el pago de 4 turnos en efectivo?',
    )
    expect(textoConfirmacion({ cantidad: 1, total: null })).toBe(
      '¿Registrar el pago de 1 turno en efectivo?',
    )
  })
})

describe('textoExito', () => {
  it('con la cantidad y el total de la respuesta', () => {
    expect(textoExito({ cantidad: 4, total: 32000 })).toBe('Pago registrado: 4 turnos por $ 32.000')
    expect(textoExito({ cantidad: 1, total: 8000 })).toBe('Pago registrado: 1 turno por $ 8.000')
  })
})

describe('textoVuelto', () => {
  it('solo si la API devolvió un vuelto; 0 también se muestra', () => {
    expect(textoVuelto({ vuelto: 3000 })).toBe('Vuelto: $ 3.000')
    expect(textoVuelto({ vuelto: 0 })).toBe('Vuelto: $ 0')
    expect(textoVuelto({ vuelto: null })).toBeNull()
  })
})
