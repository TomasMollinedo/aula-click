import { describe, expect, it } from 'vitest'

import { formatoInstante } from '@/utils/auditoria'

import {
  datosDelMedio,
  textoAdjuntadoPor,
  textoAnuladoEl,
  textoMotivoAnulacion,
  textoRedDebito,
  textoRegistradoPor,
  textoTarjeta,
  textoTituloComprobante,
  textoCantidad,
  textoConfirmacion,
  textoExito,
  textoFormaPago,
  textoHorario,
  textoImporte,
  textoNumero,
  textoNumeroComprobante,
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
  it('número del comprobante', () => {
    expect(textoNumero(1024)).toBe('N° 1024')
    expect(textoNumeroComprobante(1024)).toBe('Comprobante N° 1024')
  })
})

describe('textoCantidad', () => {
  it('singular y plural', () => {
    expect(textoCantidad(1)).toBe('1 turno')
    expect(textoCantidad(4)).toBe('4 turnos')
  })
})

describe('textoConfirmacion', () => {
  it('con total y el medio elegido', () => {
    expect(textoConfirmacion({ cantidad: 4, total: 32000 }, 'EFECTIVO')).toBe(
      `¿Registrar el pago de 4 turnos por $${NBSP}32.000,00 en efectivo?`,
    )
    expect(textoConfirmacion({ cantidad: 4, total: 32000 }, 'TRANSFERENCIA')).toBe(
      `¿Registrar el pago de 4 turnos por $${NBSP}32.000,00 por transferencia?`,
    )
    expect(textoConfirmacion({ cantidad: 1, total: 8000.5 }, 'DEBITO')).toBe(
      `¿Registrar el pago de 1 turno por $${NBSP}8.000,50 con débito?`,
    )
  })

  it('sin total (alguno sin precio)', () => {
    expect(textoConfirmacion({ cantidad: 4, total: null }, 'EFECTIVO')).toBe(
      '¿Registrar el pago de 4 turnos en efectivo?',
    )
    expect(textoConfirmacion({ cantidad: 1, total: null }, 'TRANSFERENCIA')).toBe(
      '¿Registrar el pago de 1 turno por transferencia?',
    )
  })
})

describe('textoFormaPago', () => {
  it('el nombre de cada forma, el del catálogo', () => {
    expect(textoFormaPago('EFECTIVO')).toBe('Efectivo')
    expect(textoFormaPago('TRANSFERENCIA')).toBe('Transferencia')
    expect(textoFormaPago('DEBITO')).toBe('Tarjeta de débito')
  })
})

describe('textoExito', () => {
  it('con la cantidad, el total y el medio de la respuesta', () => {
    expect(textoExito({ cantidad: 4, total: 32000, formaPago: 'TRANSFERENCIA' })).toBe(
      `Pago registrado: 4 turnos por $${NBSP}32.000,00 por transferencia`,
    )
    expect(textoExito({ cantidad: 1, total: 8000, formaPago: 'EFECTIVO' })).toBe(
      `Pago registrado: 1 turno por $${NBSP}8.000,00 en efectivo`,
    )
    expect(textoExito({ cantidad: 2, total: 16000, formaPago: 'DEBITO' })).toBe(
      `Pago registrado: 2 turnos por $${NBSP}16.000,00 con débito`,
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

// Detalle de un pago (T-99): los mismos textos que el comprobante de pago en PDF de la API.
describe('textos del detalle del pago', () => {
  it('el título es el del comprobante de pago, con el número', () => {
    expect(textoTituloComprobante(1024)).toBe('Comprobante de pago N° 1024')
  })

  it.each([
    ['ERROR_CARGA', null, 'Error de carga'],
    ['FORMA_PAGO_EQUIVOCADA', null, 'Forma de pago equivocada'],
    ['OTRO', null, 'Otro motivo'],
    ['ERROR_CARGA', 'Se cargó dos veces', 'Error de carga: Se cargó dos veces'],
    ['OTRO', 'Pagó otro familiar', 'Otro motivo: Pagó otro familiar'],
  ] as const)('motivo %s con detalle %s → %s', (motivo, detalle, texto) => {
    expect(textoMotivoAnulacion({ motivo, detalle })).toBe(texto)
  })

  it.each([
    ['VISA_DEBITO', 'Visa Débito'],
    ['MASTERCARD_DEBITO', 'Mastercard Débito'],
    ['MAESTRO', 'Maestro'],
    ['CABAL_DEBITO', 'Cabal Débito'],
    ['OTRA', 'Otra'],
  ] as const)('red %s → %s', (red, texto) => {
    expect(textoRedDebito(red)).toBe(texto)
  })

  it('la tarjeta, con el resto oculto', () => {
    expect(textoTarjeta('1234')).toBe('**** 1234')
  })

  it('quién anuló, registró y adjuntó, con el instante en la hora local', () => {
    const laura = { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' }
    const instante = '2026-10-06T12:00:00.000Z'
    const cuando = formatoInstante(instante)

    expect(textoAnuladoEl({ anuladoPor: laura, anuladoEl: instante })).toBe(
      `Anulado el ${cuando} por Laura Gómez`,
    )
    expect(textoRegistradoPor(laura, instante)).toBe(`Registrado por Laura Gómez · ${cuando}`)
    expect(textoAdjuntadoPor(laura, instante)).toBe(`Adjuntado por Laura Gómez · ${cuando}`)
  })
})

describe('datosDelMedio', () => {
  const sinMedio = { montoRecibido: null, vuelto: null, transferencia: null, debito: null }

  it('efectivo: monto recibido y vuelto, los de la API', () => {
    expect(datosDelMedio({ ...sinMedio, montoRecibido: 20000, vuelto: 3000 })).toEqual([
      { label: 'Monto recibido', valor: `$${NBSP}20.000,00` },
      { label: 'Vuelto', valor: `$${NBSP}3.000,00` },
    ])
  })

  it('efectivo con vuelto 0: se muestra (el monto era justo)', () => {
    expect(datosDelMedio({ ...sinMedio, montoRecibido: 8000, vuelto: 0 })).toEqual([
      { label: 'Monto recibido', valor: `$${NBSP}8.000,00` },
      { label: 'Vuelto', valor: `$${NBSP}0,00` },
    ])
  })

  it('un efectivo sin monto recibido (anterior a que fuera obligatorio): nada', () => {
    expect(datosDelMedio(sinMedio)).toEqual([])
  })

  it('transferencia: operación, banco y titular; sin titular, no va', () => {
    const transferencia = { operacion: '0004829137', banco: 'Banco Macro', titular: 'Marta López' }
    expect(datosDelMedio({ ...sinMedio, transferencia })).toEqual([
      { label: 'Operación', valor: '0004829137' },
      { label: 'Banco', valor: 'Banco Macro' },
      { label: 'Titular', valor: 'Marta López' },
    ])
    expect(
      datosDelMedio({ ...sinMedio, transferencia: { ...transferencia, titular: null } }),
    ).toEqual([
      { label: 'Operación', valor: '0004829137' },
      { label: 'Banco', valor: 'Banco Macro' },
    ])
  })

  it('débito: red, cupón y la tarjeta; sin los últimos 4, no va', () => {
    const debito = { red: 'VISA_DEBITO' as const, cupon: '000123', ultimos4: '1234' }
    expect(datosDelMedio({ ...sinMedio, debito })).toEqual([
      { label: 'Red', valor: 'Visa Débito' },
      { label: 'Cupón', valor: '000123' },
      { label: 'Tarjeta', valor: '**** 1234' },
    ])
    expect(datosDelMedio({ ...sinMedio, debito: { ...debito, ultimos4: null } })).toEqual([
      { label: 'Red', valor: 'Visa Débito' },
      { label: 'Cupón', valor: '000123' },
    ])
  })
})
