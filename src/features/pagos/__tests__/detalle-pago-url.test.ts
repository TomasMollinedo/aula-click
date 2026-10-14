import { describe, expect, it } from 'vitest'

import { leerPagoId, paramsConPago, paramsSinPago } from '../detalle-pago-url'

describe('leerPagoId', () => {
  it('lee el id del pago', () => {
    expect(leerPagoId(new URLSearchParams('pago=31'))).toBe(31)
  })

  it.each([
    ['sin pago', 'tab=pagos'],
    ['un pago que no es un entero', 'pago=abc'],
    ['un pago en cero', 'pago=0'],
    ['un pago negativo', 'pago=-4'],
    ['un pago decimal', 'pago=1.5'],
    ['un pago vacío', 'pago='],
  ])('%s → null', (_caso, query) => {
    expect(leerPagoId(new URLSearchParams(query))).toBeNull()
  })
})

describe('paramsConPago y paramsSinPago', () => {
  it('abren el pago y conservan la pestaña, la subpestaña y los filtros', () => {
    const params = new URLSearchParams('tab=pagos&vista=realizados&desde=2026-10-01')
    expect(paramsConPago(params, 31).toString()).toBe(
      'tab=pagos&vista=realizados&desde=2026-10-01&pago=31',
    )
  })

  it('cambian el pago si ya había uno', () => {
    expect(paramsConPago(new URLSearchParams('pago=4'), 31).toString()).toBe('pago=31')
  })

  it('cierran el pago sin tocar lo demás', () => {
    expect(paramsSinPago(new URLSearchParams('tab=pagos&pago=31&detalle=2')).toString()).toBe(
      'tab=pagos&detalle=2',
    )
  })

  it('no modifican los parámetros originales', () => {
    const params = new URLSearchParams('tab=pagos')
    paramsConPago(params, 31)
    expect(params.toString()).toBe('tab=pagos')
  })
})
