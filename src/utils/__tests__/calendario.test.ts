import { describe, expect, it } from 'vitest'

import {
  esFechaHabilitada,
  inicioDeMes,
  primeraHabilitadaDelMes,
  semanasDelMes,
  siguienteHabilitada,
  sumarMeses,
} from '../calendario'

// 2026-09-29 es martes; septiembre de 2026 empieza un martes y octubre, un jueves.
const MARTES = { min: '2026-09-29', diaSemana: 2 }

describe('esFechaHabilitada', () => {
  it('solo el día de la semana pedido, desde el mínimo', () => {
    expect(esFechaHabilitada('2026-09-29', MARTES)).toBe(true)
    expect(esFechaHabilitada('2026-10-06', MARTES)).toBe(true)
    expect(esFechaHabilitada('2026-09-30', MARTES)).toBe(false) // miércoles
    expect(esFechaHabilitada('2026-09-22', MARTES)).toBe(false) // martes, antes del mínimo
  })

  it('sin restricción, cualquier día', () => {
    expect(esFechaHabilitada('2026-09-30', {})).toBe(true)
  })

  it('lee la fecha como local: el 12/10/2026 es lunes (no domingo, el bug de new Date)', () => {
    expect(esFechaHabilitada('2026-10-12', { diaSemana: 1 })).toBe(true)
  })
})

describe('semanasDelMes', () => {
  it('septiembre de 2026: empieza un martes, semanas de lunes a domingo', () => {
    const semanas = semanasDelMes('2026-09-15')
    expect(semanas[0]).toEqual([
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
    expect(semanas.at(-1)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      null,
      null,
      null,
      null,
    ])
    expect(semanas.every((semana) => semana.length === 7)).toBe(true)
  })

  it('febrero de 2027 (28 días, empieza lunes): cuatro semanas justas', () => {
    const semanas = semanasDelMes('2027-02-01')
    expect(semanas).toHaveLength(4)
    expect(semanas[0]?.[0]).toBe('2027-02-01')
    expect(semanas[3]?.[6]).toBe('2027-02-28')
  })
})

describe('inicioDeMes y sumarMeses', () => {
  it('cruce de año', () => {
    expect(inicioDeMes('2026-12-31')).toBe('2026-12-01')
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(sumarMeses('2027-01-01', -1)).toBe('2026-12-01')
  })
})

describe('siguienteHabilitada', () => {
  it('de a un día salta al próximo martes; de a siete, al martes siguiente', () => {
    expect(siguienteHabilitada('2026-09-29', 1, MARTES)).toBe('2026-10-06')
    expect(siguienteHabilitada('2026-10-06', 7, MARTES)).toBe('2026-10-13')
    expect(siguienteHabilitada('2026-10-06', -1, MARTES)).toBe('2026-09-29')
  })

  it('antes del mínimo no hay: null', () => {
    expect(siguienteHabilitada('2026-09-29', -7, MARTES)).toBeNull()
  })
})

describe('primeraHabilitadaDelMes', () => {
  it('el primer martes del mes desde el mínimo', () => {
    expect(primeraHabilitadaDelMes('2026-09-01', MARTES)).toBe('2026-09-29')
    expect(primeraHabilitadaDelMes('2026-10-01', MARTES)).toBe('2026-10-06')
  })

  it('un mes entero antes del mínimo: null', () => {
    expect(primeraHabilitadaDelMes('2026-08-01', MARTES)).toBeNull()
  })
})
