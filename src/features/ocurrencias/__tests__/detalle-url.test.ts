import { describe, expect, it } from 'vitest'

import { leerDetalle, paramsConDetalle, paramsSinDetalle } from '../detalle-url'

describe('leerDetalle', () => {
  it('lee el turno y la fecha original', () => {
    expect(leerDetalle(new URLSearchParams('detalle=31&fecha=2026-10-12'))).toEqual({
      turnoId: 31,
      fecha: '2026-10-12',
    })
  })

  it.each([
    ['sin detalle', 'fecha=2026-10-12'],
    ['sin fecha', 'detalle=31'],
    ['detalle que no es un entero positivo', 'detalle=abc&fecha=2026-10-12'],
    ['detalle en cero', 'detalle=0&fecha=2026-10-12'],
    ['fecha con otro formato', 'detalle=31&fecha=12/10/2026'],
  ])('%s → null', (_caso, query) => {
    expect(leerDetalle(new URLSearchParams(query))).toBeNull()
  })
})

describe('paramsConDetalle y paramsSinDetalle', () => {
  it('conserva los demás parámetros y no toca los originales', () => {
    const original = new URLSearchParams('tab=turnos&estado=AGENDADO')
    const con = paramsConDetalle(original, { turnoId: 31, fecha: '2026-10-12' })

    expect(con.toString()).toBe('tab=turnos&estado=AGENDADO&detalle=31&fecha=2026-10-12')
    expect(original.toString()).toBe('tab=turnos&estado=AGENDADO')
  })

  it('al cerrar saca el detalle y la fecha', () => {
    const con = new URLSearchParams('tab=turnos&detalle=31&fecha=2026-10-12')

    expect(paramsSinDetalle(con, { conservarFecha: false }).toString()).toBe('tab=turnos')
  })

  it('en una agenda conserva la fecha, que es la que se está viendo', () => {
    const con = new URLSearchParams('detalle=31&fecha=2026-10-12&vista=semana')

    expect(paramsSinDetalle(con, { conservarFecha: true }).toString()).toBe(
      'fecha=2026-10-12&vista=semana',
    )
  })
})
