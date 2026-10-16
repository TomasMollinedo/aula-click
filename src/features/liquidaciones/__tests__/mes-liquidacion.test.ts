import { describe, expect, it } from 'vitest'

import {
  leerMesLiquidacion,
  mesAnterior,
  mesSiguiente,
  paramsConMes,
  paramsConPagina,
} from '../mes-liquidacion'

const leer = (qs: string) => leerMesLiquidacion(new URLSearchParams(qs))

describe('leerMesLiquidacion', () => {
  it('sin parámetros: sin mes (manda la API) y la página 1', () => {
    expect(leer('')).toEqual({ mes: undefined, page: 1 })
  })

  it('un mes AAAA-MM y una página', () => {
    expect(leer('mes=2026-09&page=3')).toEqual({ mes: '2026-09', page: 3 })
  })

  it('un mes futuro se lee igual: lo rechaza la API', () => {
    expect(leer('mes=2030-01').mes).toBe('2030-01')
  })

  it.each(['2026-13', '2026-00', '2026-9', '2026-09-01', 'octubre', ''])(
    'un mes inválido (%s) es sin mes',
    (mes) => {
      expect(leer(`mes=${mes}`).mes).toBeUndefined()
    },
  )

  it.each(['0', '-1', '1.5', 'abc'])('una página inválida (%s) es la 1', (page) => {
    expect(leer(`page=${page}`).page).toBe(1)
  })
})

describe('paramsConMes', () => {
  it('escribe el mes, conserva el resto y vuelve a la página 1', () => {
    const params = paramsConMes(new URLSearchParams('mes=2026-09&page=2&otro=x'), '2026-08')
    expect(params.get('mes')).toBe('2026-08')
    expect(params.get('otro')).toBe('x')
    expect(params.has('page')).toBe(false)
  })

  it('no muta los parámetros recibidos', () => {
    const actuales = new URLSearchParams('page=2')
    paramsConMes(actuales, '2026-08')
    expect(actuales.toString()).toBe('page=2')
  })
})

describe('paramsConPagina', () => {
  it('escribe la página y conserva el mes', () => {
    expect(paramsConPagina(new URLSearchParams('mes=2026-09'), 2).toString()).toBe(
      'mes=2026-09&page=2',
    )
  })

  it('la 1 no se escribe', () => {
    expect(paramsConPagina(new URLSearchParams('mes=2026-09&page=2'), 1).toString()).toBe(
      'mes=2026-09',
    )
  })
})

describe('mesAnterior y mesSiguiente', () => {
  it('dentro del año', () => {
    expect(mesAnterior('2026-10')).toBe('2026-09')
    expect(mesSiguiente('2026-10')).toBe('2026-11')
  })

  it('cruce de año', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesSiguiente('2026-12')).toBe('2027-01')
  })
})
