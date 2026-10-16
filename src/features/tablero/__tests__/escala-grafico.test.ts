import { describe, expect, it } from 'vitest'

import { escalaDelEje } from '../escala-grafico'

// La escala del eje del gráfico de la evolución (HU-47): un tope redondo arriba de la barra más
// alta, con pasos de 1, 2 o 5 por una potencia de 10.

describe('escalaDelEje', () => {
  it('redondea el tope hacia arriba, en pasos que se leen de un vistazo', () => {
    // 128.000 / 3 = 42.666 → paso de 50.000.
    expect(escalaDelEje(128000)).toEqual({
      tope: 150000,
      valores: [0, 50000, 100000, 150000],
    })
  })

  it('el tope nunca queda por debajo del valor más alto', () => {
    for (const maximo of [1, 7, 99, 100, 128000, 1234567, 0.5]) {
      expect(escalaDelEje(maximo).tope).toBeGreaterThanOrEqual(maximo)
    }
  })

  it('los valores van de 0 al tope, repartidos en partes iguales', () => {
    const { tope, valores } = escalaDelEje(96000, 4)
    expect(valores).toHaveLength(5)
    expect(valores[0]).toBe(0)
    expect(valores[4]).toBe(tope)
    expect(valores[1]).toBe(tope / 4)
  })

  it('sin ruido de coma flotante en importes chicos', () => {
    expect(escalaDelEje(0.5).valores).toEqual([0, 0.2, 0.4, 0.6])
  })

  it('un valor que ya es redondo no agranda el tope de más', () => {
    expect(escalaDelEje(150000).tope).toBe(150000)
    expect(escalaDelEje(3).tope).toBe(3)
  })

  it('sin movimientos no hay escala: sólo la línea del cero', () => {
    expect(escalaDelEje(0)).toEqual({ tope: 0, valores: [] })
    expect(escalaDelEje(-5)).toEqual({ tope: 0, valores: [] })
  })
})
