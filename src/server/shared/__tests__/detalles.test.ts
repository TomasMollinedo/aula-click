import { describe, expect, it } from 'vitest'
import { detallesPorPosicion } from '../detalles'

describe('detallesPorPosicion', () => {
  it('marca cada id que cumple la condición con su posición en la lista', () => {
    expect(
      detallesPorPosicion(
        'bloqueIds',
        [10, 99, 11, 98],
        (id) => id > 50,
        (id) => `El ${id} no existe`,
      ),
    ).toEqual([
      { path: ['bloqueIds', 1], message: 'El 99 no existe' },
      { path: ['bloqueIds', 3], message: 'El 98 no existe' },
    ])
  })

  it('agrega los datos de `extra` a cada detalle', () => {
    expect(
      detallesPorPosicion(
        'materiaIds',
        [2],
        () => true,
        () => 'Tiene turnos',
        () => ({ cantidad: 3 }),
      ),
    ).toEqual([{ path: ['materiaIds', 0], message: 'Tiene turnos', cantidad: 3 }])
  })

  it('devuelve [] si ninguno cumple la condición', () => {
    expect(
      detallesPorPosicion(
        'ids',
        [1, 2],
        () => false,
        () => '',
      ),
    ).toEqual([])
  })
})
