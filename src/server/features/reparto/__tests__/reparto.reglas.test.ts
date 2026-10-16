import { describe, expect, it } from 'vitest'
import { repartoDeTurno, sumarReparto, textoPorcentaje } from '../reparto.reglas'

// Regla del reparto (HU-43, T-120): pura, sin base.

const centavos = (pesos: number) => Math.round(pesos * 100)

describe('repartoDeTurno', () => {
  it('$ 8.000 al 15 % → $ 1.200 para el centro y $ 6.800 para el profesor (ejemplo de la HU)', () => {
    expect(repartoDeTurno(8000, 15)).toEqual({
      importe: 8000,
      porcentaje: 15,
      parteCentro: 1200,
      parteProfesor: 6800,
    })
  })

  it('0 % → todo al profesor', () => {
    expect(repartoDeTurno(8000, 0)).toMatchObject({ parteCentro: 0, parteProfesor: 8000 })
  })

  it('99,99 % de $ 8.000 → $ 7.999,20 y $ 0,80', () => {
    expect(repartoDeTurno(8000, 99.99)).toMatchObject({ parteCentro: 7999.2, parteProfesor: 0.8 })
  })

  it('$ 3.333,33 al 15 % → 499,9995 redondea hacia arriba a $ 500', () => {
    expect(repartoDeTurno(3333.33, 15)).toMatchObject({ parteCentro: 500, parteProfesor: 2833.33 })
  })

  it('empate exacto: $ 0,10 al 15 % → 1,5 centavos redondea a $ 0,02', () => {
    expect(repartoDeTurno(0.1, 15)).toMatchObject({ parteCentro: 0.02, parteProfesor: 0.08 })
  })

  it.each([
    [8000, 15],
    [3333.33, 15],
    [1234.56, 18.5],
    [999.99, 12.25],
    [0.01, 99.99],
    [7777.77, 33.33],
    [100.1, 0.01],
    [0, 15],
  ])('$ %d al %d %%: las dos partes suman el importe', (importe, porcentaje) => {
    const reparto = repartoDeTurno(importe, porcentaje)
    expect(centavos(reparto.parteCentro) + centavos(reparto.parteProfesor)).toBe(centavos(importe))
  })

  it('importe negativo → RangeError', () => {
    expect(() => repartoDeTurno(-1, 15)).toThrow(RangeError)
  })

  it.each([100, -1])('porcentaje %d → RangeError', (porcentaje) => {
    expect(() => repartoDeTurno(8000, porcentaje)).toThrow(RangeError)
  })
})

describe('sumarReparto', () => {
  it('suma en centavos', () => {
    expect(
      sumarReparto([
        repartoDeTurno(8000, 15),
        repartoDeTurno(3333.33, 15),
        repartoDeTurno(0.1, 15),
      ]),
    ).toEqual({ importe: 11333.43, parteCentro: 1700.02, parteProfesor: 9633.41 })
  })

  it('con dos repartos', () => {
    expect(sumarReparto([repartoDeTurno(8000, 15), repartoDeTurno(8000, 18)])).toEqual({
      importe: 16000,
      parteCentro: 2640,
      parteProfesor: 13360,
    })
  })

  it('lista vacía → todo en 0', () => {
    expect(sumarReparto([])).toEqual({ importe: 0, parteCentro: 0, parteProfesor: 0 })
  })
})

describe('textoPorcentaje', () => {
  it.each([
    [15, '15 %'],
    [18.5, '18,5 %'],
    [12.25, '12,25 %'],
  ])('%d → %s', (porcentaje, texto) => {
    expect(textoPorcentaje(porcentaje)).toBe(texto)
  })
})
