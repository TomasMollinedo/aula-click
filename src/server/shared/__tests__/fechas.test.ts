import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateAFecha, diaSemanaISO, fechaADate, hoy, proximaFechaDelDia } from '../fechas'

describe('hoy', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a las 23:30 hora Salta devuelve el día de Salta, no el de UTC', () => {
    expect(hoy(() => new Date('2026-09-23T02:30:00Z'))).toBe('2026-09-22')
  })

  it.each([
    ['2026-09-23T03:00:00Z', '2026-09-23'],
    ['2026-01-01T02:59:00Z', '2025-12-31'],
    ['2028-03-01T02:00:00Z', '2028-02-29'],
  ])('a las %s devuelve %s', (instante, fecha) => {
    expect(hoy(() => new Date(instante))).toBe(fecha)
  })

  it('sin reloj usa el del sistema', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T02:30:00Z'))
    expect(hoy()).toBe('2026-09-22')
  })
})

describe('fechaADate', () => {
  it('devuelve las 00:00 UTC de ese día', () => {
    expect(fechaADate('2026-09-22').toISOString()).toBe('2026-09-22T00:00:00.000Z')
  })

  it.each(['2026-02-30', '2026-13-01', '26-09-22', ''])('lanza RangeError con %o', (fecha) => {
    expect(() => fechaADate(fecha)).toThrow(RangeError)
  })
})

describe('dateAFecha', () => {
  it('usa los campos UTC', () => {
    expect(dateAFecha(new Date('2026-09-22T00:00:00.000Z'))).toBe('2026-09-22')
  })

  it.each(['2026-09-22', '2028-02-29', '2025-12-31', '2026-01-01'])(
    'es la inversa de fechaADate (%s)',
    (fecha) => {
      expect(dateAFecha(fechaADate(fecha))).toBe(fecha)
    },
  )

  it('lanza RangeError con un Invalid Date', () => {
    expect(() => dateAFecha(new Date(Number.NaN))).toThrow(RangeError)
  })
})

describe('diaSemanaISO', () => {
  it.each([
    ['2026-09-21', 1],
    ['2026-09-22', 2],
    ['2026-09-27', 7],
  ])('%s → %i', (fecha, dia) => {
    expect(diaSemanaISO(fecha)).toBe(dia)
  })

  it('lanza RangeError con una fecha inválida', () => {
    expect(() => diaSemanaISO('2026-02-30')).toThrow(RangeError)
  })
})

describe('proximaFechaDelDia', () => {
  // 2026-09-22 es martes (2).
  it.each([
    [2, '2026-09-22', '2026-09-22'], // hoy es ese día: hoy incluido
    [3, '2026-09-22', '2026-09-23'], // mañana
    [1, '2026-09-22', '2026-09-28'], // el lunes ya pasó: el de la semana que viene
    [7, '2026-09-22', '2026-09-27'], // domingo = 7
    [7, '2026-09-27', '2026-09-27'], // desde un domingo, domingo
    [1, '2026-09-27', '2026-09-28'], // desde un domingo, el lunes siguiente
    [4, '2026-09-29', '2026-10-01'], // cruce de mes
    [1, '2026-12-30', '2027-01-04'], // cruce de año
    [2, '2028-02-28', '2028-02-29'], // año bisiesto
  ])('día %i desde %s → %s', (dia, desde, esperada) => {
    expect(proximaFechaDelDia(dia, desde)).toBe(esperada)
    expect(diaSemanaISO(proximaFechaDelDia(dia, desde))).toBe(dia)
  })

  it.each([0, 8, 1.5, Number.NaN])('lanza RangeError con el día %o', (dia) => {
    expect(() => proximaFechaDelDia(dia, '2026-09-22')).toThrow(RangeError)
  })

  it('lanza RangeError con una fecha inválida', () => {
    expect(() => proximaFechaDelDia(1, '2026-02-30')).toThrow(RangeError)
  })
})
