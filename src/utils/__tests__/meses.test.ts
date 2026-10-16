import { describe, expect, it } from 'vitest'

import {
  ANIOS_OFRECIDOS,
  anioDe,
  aniosOfrecidos,
  esMesFuturo,
  etiquetaNumeroMes,
  MESES_DEL_ANIO,
  mesDeAnioYNumero,
  numeroDeMes,
} from '../meses'

describe('anioDe, numeroDeMes y mesDeAnioYNumero', () => {
  it('parten y arman un mes YYYY-MM (también desde una fecha)', () => {
    expect(anioDe('2026-09')).toBe(2026)
    expect(numeroDeMes('2026-09')).toBe(9)
    expect(anioDe('2026-09-15')).toBe(2026)
    expect(numeroDeMes('2026-09-15')).toBe(9)
    expect(mesDeAnioYNumero(2026, 9)).toBe('2026-09')
    expect(mesDeAnioYNumero(2026, 12)).toBe('2026-12')
  })
})

describe('MESES_DEL_ANIO y etiquetaNumeroMes', () => {
  it('son los doce meses, del 1 al 12', () => {
    expect(MESES_DEL_ANIO).toHaveLength(12)
    expect(MESES_DEL_ANIO[0]).toBe(1)
    expect(MESES_DEL_ANIO[11]).toBe(12)
  })

  it('el nombre del mes, en minúsculas y en español', () => {
    expect(etiquetaNumeroMes(1)).toBe('enero')
    expect(etiquetaNumeroMes(9)).toBe('septiembre')
    expect(etiquetaNumeroMes(12)).toBe('diciembre')
  })
})

describe('aniosOfrecidos', () => {
  it('el año de hoy y los anteriores, del más reciente al más antiguo', () => {
    expect(aniosOfrecidos('2026-10-16')).toEqual([2026, 2025, 2024])
    expect(aniosOfrecidos('2026-10-16')).toHaveLength(ANIOS_OFRECIDOS)
  })

  it('un mes elegido dentro de la lista no agrega nada', () => {
    expect(aniosOfrecidos('2026-10-16', '2025-03')).toEqual([2026, 2025, 2024])
  })

  it('el año de un mes viejo que viene en la URL se agrega', () => {
    expect(aniosOfrecidos('2026-10-16', '2021-05')).toEqual([2026, 2025, 2024, 2021])
  })
})

describe('esMesFuturo', () => {
  it('es posterior al mes de hoy', () => {
    expect(esMesFuturo('2026-11', '2026-10-16')).toBe(true)
    expect(esMesFuturo('2027-01', '2026-10-16')).toBe(true)
  })

  it('el mes de hoy y los anteriores no lo son', () => {
    expect(esMesFuturo('2026-10', '2026-10-16')).toBe(false)
    expect(esMesFuturo('2026-09', '2026-10-16')).toBe(false)
  })
})
