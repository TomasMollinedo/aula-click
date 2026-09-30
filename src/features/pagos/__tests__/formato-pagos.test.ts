import { describe, expect, it } from 'vitest'

import {
  fechaDocumento,
  textoCantidad,
  textoConfirmacion,
  textoExito,
  textoHorario,
  textoImporte,
  textoNumeroComprobante,
  textoRegistradoEl,
  textoTotal,
  textoVuelto,
} from '../formato-pagos'

// `formatearPesos` (Intl) separa el `$` del número con un espacio duro (U+00A0).
const NBSP = String.fromCharCode(0xa0)

describe('textos del resumen', () => {
  it('horario, importe y total, con "Sin precio" y "sin calcular" sin importe', () => {
    expect(textoHorario('09:00', '10:00')).toBe('de 9:00 a 10:00')
    expect(textoImporte(8000)).toBe(`$${NBSP}8.000,00`)
    expect(textoImporte(null)).toBe('Sin precio')
    expect(textoTotal(32000)).toBe(`Total: $${NBSP}32.000,00`)
    expect(textoTotal(null)).toBe('Total: sin calcular')
  })
})

describe('textos del comprobante', () => {
  it('número, fecha de pago e instante del registro en hora local', () => {
    expect(textoNumeroComprobante(1024)).toBe('Comprobante N° 1024')
    expect(fechaDocumento('2026-10-05')).toBe('05/10/2026')
    // Armado en hora local: el test no depende de la zona horaria de la máquina.
    const instante = new Date(2026, 9, 5, 14, 30).toISOString()
    expect(textoRegistradoEl(instante)).toBe('Registrado el 05/10/2026 14:30')
  })
})

describe('textoCantidad', () => {
  it('singular y plural', () => {
    expect(textoCantidad(1)).toBe('1 turno')
    expect(textoCantidad(4)).toBe('4 turnos')
  })
})

describe('textoConfirmacion', () => {
  it('con total', () => {
    expect(textoConfirmacion({ cantidad: 4, total: 32000 })).toBe(
      `¿Registrar el pago de 4 turnos por $${NBSP}32.000,00 en efectivo?`,
    )
    expect(textoConfirmacion({ cantidad: 1, total: 8000.5 })).toBe(
      `¿Registrar el pago de 1 turno por $${NBSP}8.000,50 en efectivo?`,
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
    expect(textoExito({ cantidad: 4, total: 32000 })).toBe(
      `Pago registrado: 4 turnos por $${NBSP}32.000,00`,
    )
    expect(textoExito({ cantidad: 1, total: 8000 })).toBe(
      `Pago registrado: 1 turno por $${NBSP}8.000,00`,
    )
  })
})

describe('textoVuelto', () => {
  it('solo si la API devolvió un vuelto; 0 también se muestra', () => {
    expect(textoVuelto({ vuelto: 3000 })).toBe(`Vuelto: $${NBSP}3.000,00`)
    expect(textoVuelto({ vuelto: 0 })).toBe(`Vuelto: $${NBSP}0,00`)
    expect(textoVuelto({ vuelto: null })).toBeNull()
  })
})
