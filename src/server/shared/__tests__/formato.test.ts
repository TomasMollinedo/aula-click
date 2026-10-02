import { describe, expect, it } from 'vitest'
import { ahora } from '../fechas'
import {
  fechaDocumento,
  fechaHoraDocumento,
  formatearPesos,
  horaCorta,
  nombreCompleto,
  rangoHoras,
} from '../formato'

// Los mismos strings que devuelven los formateadores del frontend (`src/utils/moneda.ts`,
// `src/utils/horas.ts`, `features/pagos/formato-pagos.ts`): si uno cambia, cambia el otro.

// Intl separa el `$` del número con un espacio duro (U+00A0).
const NBSP = String.fromCharCode(0xa0)

describe('formatearPesos', () => {
  it('entero: separador de miles con punto y dos decimales', () => {
    expect(formatearPesos(7500)).toBe(`$${NBSP}7.500,00`)
  })

  it('completa a dos decimales', () => {
    expect(formatearPesos(8000.5)).toBe(`$${NBSP}8.000,50`)
    expect(formatearPesos(8000.25)).toBe(`$${NBSP}8.000,25`)
  })

  it('menos de mil: sin separador de miles', () => {
    expect(formatearPesos(0)).toBe(`$${NBSP}0,00`)
    expect(formatearPesos(0.5)).toBe(`$${NBSP}0,50`)
    expect(formatearPesos(999)).toBe(`$${NBSP}999,00`)
  })

  it('millones con centavos', () => {
    expect(formatearPesos(1234567.05)).toBe(`$${NBSP}1.234.567,05`)
  })

  it('redondea a centavos sin arrastrar el error de coma flotante', () => {
    expect(formatearPesos(0.1 + 0.2)).toBe(`$${NBSP}0,30`)
  })

  it('el tope de la API', () => {
    expect(formatearPesos(99999999.99)).toBe(`$${NBSP}99.999.999,99`)
  })
})

describe('fechaDocumento', () => {
  it('YYYY-MM-DD → dd/MM/yyyy, con los ceros a la izquierda', () => {
    expect(fechaDocumento('2026-10-05')).toBe('05/10/2026')
    expect(fechaDocumento('2026-01-31')).toBe('31/01/2026')
  })

  it.each(['', '05/10/2026', '2026-10-5', '2026-10-05T00:00:00Z', '2026-02-30'])(
    'lanza RangeError con %o',
    (fecha) => {
      expect(() => fechaDocumento(fecha)).toThrow(RangeError)
    },
  )
})

describe('fechaHoraDocumento', () => {
  it('a las 23:30 hora Salta da el día de Salta, no el de UTC', () => {
    expect(fechaHoraDocumento(new Date('2026-09-23T02:30:00Z'))).toBe('22/09/2026 23:30')
  })

  it.each([
    ['2026-10-05T14:30:00.000Z', '05/10/2026 11:30'],
    ['2026-10-05T03:00:00.000Z', '05/10/2026 00:00'],
    ['2026-01-01T02:59:00.000Z', '31/12/2025 23:59'],
    ['2026-03-07T12:05:00.000Z', '07/03/2026 09:05'],
  ])('%s → %s', (instante, texto) => {
    expect(fechaHoraDocumento(new Date(instante))).toBe(texto)
  })

  it('lanza RangeError con un Invalid Date', () => {
    expect(() => fechaHoraDocumento(new Date('no es una fecha'))).toThrow(RangeError)
  })

  it('la fecha de emisión sale del reloj inyectado, en la hora del negocio', () => {
    const reloj = () => new Date('2026-09-23T02:30:00Z')
    expect(fechaHoraDocumento(ahora(reloj))).toBe('22/09/2026 23:30')
  })
})

describe('horaCorta y rangoHoras', () => {
  it('saca el cero adelante de la hora, no el de los minutos', () => {
    expect(horaCorta('08:00')).toBe('8:00')
    expect(horaCorta('00:00')).toBe('0:00')
    expect(horaCorta('14:00')).toBe('14:00')
    expect(horaCorta('10:05')).toBe('10:05')
  })

  it('arma el rango', () => {
    expect(rangoHoras('08:00', '12:00')).toBe('8:00 a 12:00')
    expect(rangoHoras('17:00', '18:00')).toBe('17:00 a 18:00')
  })
})

describe('nombreCompleto', () => {
  it('nombre y apellido separados por un espacio', () => {
    expect(nombreCompleto('Laura', 'Gómez')).toBe('Laura Gómez')
  })

  it('sin una de las partes no deja espacios de más', () => {
    expect(nombreCompleto('Laura', '')).toBe('Laura')
    expect(nombreCompleto('', 'Gómez')).toBe('Gómez')
    expect(nombreCompleto(null, undefined)).toBe('')
  })
})
