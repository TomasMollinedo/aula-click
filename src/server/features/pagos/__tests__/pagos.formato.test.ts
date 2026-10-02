import { describe, expect, it } from 'vitest'
import { nombreArchivoComprobante, textoNumero, textoRegistradoPor } from '../pagos.formato'

// Los mismos strings que `src/features/pagos/formato-pagos.ts` (frontend).

describe('textoNumero', () => {
  it('el número tal cual, sin ceros a la izquierda', () => {
    expect(textoNumero(1024)).toBe('N° 1024')
    expect(textoNumero(7)).toBe('N° 7')
  })
})

describe('textoRegistradoPor', () => {
  it('nombre, apellido y el instante en la hora del negocio', () => {
    expect(
      textoRegistradoPor({ nombre: 'Ana', apellido: 'Pérez' }, '2026-10-05T14:30:00.000Z'),
    ).toBe('Registrado por Ana Pérez el 05/10/2026 11:30')
  })

  it('a las 23:30 hora Salta da el día de Salta, no el de UTC', () => {
    expect(
      textoRegistradoPor({ nombre: 'Laura', apellido: 'Gómez' }, '2026-09-23T02:30:00.000Z'),
    ).toBe('Registrado por Laura Gómez el 22/09/2026 23:30')
  })
})

describe('nombreArchivoComprobante', () => {
  it('sólo el número, sin extensión', () => {
    expect(nombreArchivoComprobante(32)).toBe('comprobante-32')
    expect(nombreArchivoComprobante(1024)).toBe('comprobante-1024')
  })
})
