import { describe, expect, it } from 'vitest'

import {
  crearRegistroDeAperturas,
  leerPagoId,
  paramsConPago,
  paramsSinPago,
} from '../detalle-pago-url'

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

// Lo comparten todas las instancias de `useDetallePagoEnUrl`: quien abre el detalle (el detalle del
// turno, "Pagos realizados") no es quien lo cierra (el layout de mesa).
describe('crearRegistroDeAperturas', () => {
  it('un pago abierto con un clic se cierra volviendo atrás, una sola vez', () => {
    const registro = crearRegistroDeAperturas()
    registro.marcar(31)

    expect(registro.cerrar(31)).toBe(true)
    // Ya se cerró: si vuelve a aparecer en la URL sin un clic, se entró por URL.
    expect(registro.cerrar(31)).toBe(false)
  })

  it('entrando por URL (sin clic) no se vuelve atrás', () => {
    expect(crearRegistroDeAperturas().cerrar(31)).toBe(false)
  })

  it('si en la URL hay otro pago que el abierto con el clic, no se vuelve atrás', () => {
    const registro = crearRegistroDeAperturas()
    registro.marcar(31)

    expect(registro.cerrar(40)).toBe(false)
    expect(registro.cerrar(null)).toBe(false)
  })

  it('cerrado por otro camino (Atrás del navegador), se olvida', () => {
    const registro = crearRegistroDeAperturas()
    registro.marcar(31)
    registro.olvidar()

    expect(registro.cerrar(31)).toBe(false)
  })

  it('cada registro es independiente', () => {
    const uno = crearRegistroDeAperturas()
    const otro = crearRegistroDeAperturas()
    uno.marcar(31)

    expect(otro.cerrar(31)).toBe(false)
    expect(uno.cerrar(31)).toBe(true)
  })
})
