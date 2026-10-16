import { describe, expect, it } from 'vitest'

import { rotulosDeTorta } from '../torta-rotulos'

describe('rotulosDeTorta', () => {
  it('sin nada que dibujar no hay rótulos', () => {
    expect(rotulosDeTorta([]).rotulos).toEqual([])
    expect(rotulosDeTorta([0, 0, 0]).rotulos).toEqual([])
  })

  it('cada rótulo va del lado donde cae el centro de su porción', () => {
    // Una mitad cada una, desde arriba y en el sentido de las agujas del reloj: la primera cubre
    // la derecha y la segunda, la izquierda.
    const { rotulos } = rotulosDeTorta([50, 50])

    expect(rotulos.map(({ indice, lado }) => [indice, lado])).toEqual([
      [0, 'derecha'],
      [1, 'izquierda'],
    ])
  })

  it('una porción de la derecha y de arriba queda arriba; una de abajo queda abajo', () => {
    // Un cuarto cada una: el centro de la primera está a 45° (arriba a la derecha) y el de la
    // segunda a 135° (abajo a la derecha).
    const { rotulos } = rotulosDeTorta([25, 25, 50])
    const [primera, segunda] = rotulos

    expect(primera?.lado).toBe('derecha')
    expect(segunda?.lado).toBe('derecha')
    expect(primera!.y).toBeLessThan(segunda!.y)
  })

  it('las partes en 0 no tienen rótulo y no desplazan a las demás', () => {
    const { rotulos } = rotulosDeTorta([70, 0, 30])

    expect(rotulos.map(({ indice }) => indice)).toEqual([0, 2])
  })

  it('dos rótulos del mismo lado no se pisan: quedan separados al menos por el alto de un rótulo', () => {
    // Dos porciones chicas y pegadas, las dos arriba a la derecha.
    const { rotulos } = rotulosDeTorta([5, 5, 90], { altoRotulo: 76 })
    const [a, b] = rotulos

    expect(a?.lado).toBe('derecha')
    expect(b?.lado).toBe('derecha')
    expect(b!.y - a!.y).toBeGreaterThanOrEqual(76)
  })

  it('el contenedor mide lo necesario para que entren todos', () => {
    const { rotulos, alto } = rotulosDeTorta([5, 5, 90], { altoRotulo: 76 })
    const mayor = Math.max(...rotulos.map(({ y }) => Math.abs(y)))

    expect(alto).toBe(2 * mayor + 76)
  })

  it('el punto de la porción está sobre el borde de la torta', () => {
    const { rotulos } = rotulosDeTorta([100])
    const borde = rotulos[0]!.borde

    // Una sola porción: su centro está abajo (a 180°).
    expect(borde.x).toBe(0)
    expect(borde.y).toBeGreaterThan(0)
  })
})
