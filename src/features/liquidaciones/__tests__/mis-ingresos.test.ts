import { describe, expect, it } from 'vitest'

import {
  hrefAsistenciaDelDia,
  leerLiquidacionAbierta,
  leerPestana,
  paginar,
  paramsConLiquidacion,
  paramsConPestana,
  textoMostrando,
} from '../mis-ingresos'
import { hrefPdfMiLiquidacion } from '../rutas-liquidaciones'

describe('leerLiquidacionAbierta', () => {
  it('el mes de ?liquidacion=', () => {
    expect(leerLiquidacionAbierta(new URLSearchParams('liquidacion=2026-09'))).toBe('2026-09')
  })

  it.each(['', 'liquidacion=2026-13', 'liquidacion=septiembre', 'liquidacion=2026-9'])(
    '%s: ninguna abierta',
    (qs) => {
      expect(leerLiquidacionAbierta(new URLSearchParams(qs))).toBeNull()
    },
  )
})

describe('paramsConLiquidacion', () => {
  it('abre una liquidación y conserva la página', () => {
    expect(paramsConLiquidacion(new URLSearchParams('page=2'), '2026-09').toString()).toBe(
      'page=2&liquidacion=2026-09',
    )
  })

  it('con null la cierra', () => {
    expect(
      paramsConLiquidacion(new URLSearchParams('liquidacion=2026-09&page=2'), null).toString(),
    ).toBe('page=2')
  })
})

describe('enlaces', () => {
  it('hrefAsistenciaDelDia: "Asistencia" en el día de la clase', () => {
    expect(hrefAsistenciaDelDia('/profesor/asistencia', '2026-10-14')).toBe(
      '/profesor/asistencia?fecha=2026-10-14',
    )
  })

  it('hrefPdfMiLiquidacion: el PDF del profesor de la sesión, sin profesorId', () => {
    expect(hrefPdfMiLiquidacion('2026-09')).toBe(
      '/api/v1/liquidaciones/mis-liquidaciones/2026-09/pdf',
    )
  })
})

describe('pestañas', () => {
  it('sin ?tab= (o con una desconocida) es "Este mes"', () => {
    expect(leerPestana(new URLSearchParams())).toBe('este-mes')
    expect(leerPestana(new URLSearchParams('tab=otra'))).toBe('este-mes')
  })

  it.each(['sin-cobrar', 'sin-asistencia', 'liquidaciones'] as const)('lee %s', (pestana) => {
    expect(leerPestana(new URLSearchParams(`tab=${pestana}`))).toBe(pestana)
  })

  it('paramsConPestana escribe la pestaña, no escribe "Este mes" y conserva lo demás', () => {
    expect(paramsConPestana(new URLSearchParams('page=2'), 'liquidaciones').toString()).toBe(
      'page=2&tab=liquidaciones',
    )
    expect(paramsConPestana(new URLSearchParams('tab=sin-cobrar'), 'este-mes').toString()).toBe('')
  })
})

describe('paginar', () => {
  const numeros = Array.from({ length: 23 }, (_, i) => i + 1)

  it('10 por página', () => {
    expect(paginar(numeros, 1)).toEqual({ items: numeros.slice(0, 10), page: 1, totalPages: 3 })
    expect(paginar(numeros, 3)).toEqual({ items: [21, 22, 23], page: 3, totalPages: 3 })
  })

  it('una página fuera de rango cae en la última, y sin ítems hay una página vacía', () => {
    expect(paginar(numeros, 9).page).toBe(3)
    expect(paginar([], 2)).toEqual({ items: [], page: 1, totalPages: 1 })
  })
})

describe('textoMostrando', () => {
  const clases = { singular: 'clase', plural: 'clases' }

  it('el rango de la página y el total', () => {
    expect(textoMostrando(1, 23, clases)).toBe('Mostrando 1–10 de 23 clases')
    expect(textoMostrando(3, 23, clases)).toBe('Mostrando 21–23 de 23 clases')
  })

  it('en singular con un solo registro', () => {
    expect(textoMostrando(1, 1, clases)).toBe('Mostrando 1–1 de 1 clase')
  })
})
