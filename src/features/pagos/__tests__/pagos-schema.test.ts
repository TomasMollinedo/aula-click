import { describe, expect, it } from 'vitest'

import { armarRegistrarPago, pagoFormSchema, parsearMonto } from '../pagos.schema'

describe('parsearMonto', () => {
  it.each([
    ['32000', 32000],
    ['32000,50', 32000.5],
    ['32000,5', 32000.5],
    ['32000.5', 32000.5],
    ['32000.55', 32000.55],
    ['32.000', 32000],
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['1.234.567,50', 1234567.5],
    ['32.000,05', 32000.05],
    ['0,5', 0.5],
    ['0', 0],
  ])('acepta %s → %s', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado)
  })

  it('descarta espacios y un $ inicial', () => {
    expect(parsearMonto('$ 32.000')).toBe(32000)
    expect(parsearMonto('  $32000,50 ')).toBe(32000.5)
    expect(parsearMonto('32 000')).toBe(32000)
  })

  it('vacío o solo espacios: null (no se informa)', () => {
    expect(parsearMonto('')).toBeNull()
    expect(parsearMonto('   ')).toBeNull()
    expect(parsearMonto('$')).toBeNull()
  })

  it.each([
    ['1,234.56', 'punto y coma al estilo inglés'],
    ['32,000', 'coma seguida de tres dígitos (¿miles al estilo inglés?)'],
    ['32.000.5', 'puntos que no forman grupos de 3'],
    ['1.23.456', 'grupo de miles incompleto'],
    ['0.500.000', 'primer grupo de miles con 0'],
    ['32000.555', 'más de dos decimales'],
    ['1,2,3', 'más de una coma'],
    ['32,000,00', 'más de una coma'],
  ])('rechaza lo ambiguo: %s (%s)', (texto) => {
    expect(parsearMonto(texto)).toBeNull()
  })

  it.each(['abc', '-3000', '+3000', '.5', '5.', '5,', ',5', '32000$', '$$32000', '1e5'])(
    'rechaza lo inválido: %s',
    (texto) => {
      expect(parsearMonto(texto)).toBeNull()
    },
  )
})

describe('pagoFormSchema', () => {
  const valido = { fechaPago: '2026-10-05', montoRecibido: '35000', observaciones: '' }

  function errores(valores: Record<string, unknown>) {
    const resultado = pagoFormSchema.safeParse(valores)
    return resultado.success ? [] : resultado.error.issues.map((i) => [i.path[0], i.message])
  }

  it('acepta el formulario mínimo, sin observaciones', () => {
    expect(errores(valido)).toEqual([])
    expect(errores({ fechaPago: '2026-10-05', montoRecibido: '35000' })).toEqual([])
  })

  it('montoRecibido obligatorio: vacío, solo espacios o ausente no pasan', () => {
    expect(errores({ ...valido, montoRecibido: '' })).toEqual([
      ['montoRecibido', 'Campo obligatorio'],
    ])
    expect(errores({ ...valido, montoRecibido: '   ' })).toEqual([
      ['montoRecibido', 'Campo obligatorio'],
    ])
    expect(errores({ fechaPago: '2026-10-05' })).toEqual([['montoRecibido', 'Campo obligatorio']])
  })

  it('fechaPago obligatoria y con formato válido (no valida que no sea futura)', () => {
    expect(errores({ ...valido, fechaPago: '' })).toEqual([['fechaPago', 'Campo obligatorio']])
    expect(errores({ ...valido, fechaPago: '05/10/2026' })).toEqual([
      ['fechaPago', 'Fecha inválida: debe tener formato AAAA-MM-DD'],
    ])
    expect(errores({ ...valido, fechaPago: '2026-02-30' })).toEqual([
      ['fechaPago', 'La fecha no es válida'],
    ])
    expect(errores({ ...valido, fechaPago: '2099-01-01' })).toEqual([])
  })

  it('montoRecibido: legible, mayor a 0 y hasta dos decimales; no lo compara con el total', () => {
    expect(errores({ ...valido, montoRecibido: '35.000' })).toEqual([])
    expect(errores({ ...valido, montoRecibido: '1' })).toEqual([])
    expect(errores({ ...valido, montoRecibido: 'abc' })).toEqual([
      [
        'montoRecibido',
        'Monto inválido: usá números con hasta dos decimales (por ejemplo 32.000 o 32000,50)',
      ],
    ])
    expect(errores({ ...valido, montoRecibido: '32000,555' })).toHaveLength(1)
    expect(errores({ ...valido, montoRecibido: '0' })).toEqual([
      ['montoRecibido', 'Debe ser mayor a 0'],
    ])
    expect(errores({ ...valido, montoRecibido: '0,00' })).toEqual([
      ['montoRecibido', 'Debe ser mayor a 0'],
    ])
  })

  it('observaciones hasta 500 caracteres', () => {
    expect(errores({ ...valido, observaciones: 'a'.repeat(500) })).toEqual([])
    expect(errores({ ...valido, observaciones: 'a'.repeat(501) })).toEqual([
      ['observaciones', 'No puede superar los 500 caracteres'],
    ])
  })
})

describe('armarRegistrarPago', () => {
  // Mostradas en este orden (no es el de fecha): el body lo respeta.
  const OCURRENCIAS = [
    { turnoId: 57, fecha: '2026-10-07' },
    { turnoId: 41, fecha: '2026-10-05' },
    { turnoId: 41, fecha: '2026-10-12' },
  ]

  it('las ocurrencias van como pares (turnoId, fecha) en el mismo orden en que se muestran', () => {
    const body = armarRegistrarPago(
      12,
      OCURRENCIAS.map((o) => ({ ...o, horaInicio: '09:00', importe: 8000 })),
      { fechaPago: '2026-10-05', montoRecibido: '35000', observaciones: 'Paga el mes de octubre' },
    )
    expect(body).toEqual({
      alumnoId: 12,
      ocurrencias: OCURRENCIAS,
      fechaPago: '2026-10-05',
      montoRecibido: 35000,
      observaciones: 'Paga el mes de octubre',
    })
  })

  it('un monto que no se puede leer nunca se omite: viaja 0 y la API lo rechaza', () => {
    const body = armarRegistrarPago(12, OCURRENCIAS, {
      fechaPago: '2026-10-05',
      montoRecibido: '  ',
    })
    expect(body.montoRecibido).toBe(0)
  })

  it('monto con coma y puntos de miles: número JSON', () => {
    const body = armarRegistrarPago(12, OCURRENCIAS, {
      fechaPago: '2026-10-05',
      montoRecibido: '$ 30.000,50',
    })
    expect(body.montoRecibido).toBe(30000.5)
  })

  it('observaciones con trim; vacías o solo espacios se omiten', () => {
    expect(
      armarRegistrarPago(12, OCURRENCIAS, {
        fechaPago: '2026-10-05',
        montoRecibido: '35000',
        observaciones: '  Efectivo  ',
      }).observaciones,
    ).toBe('Efectivo')
    expect(
      armarRegistrarPago(12, OCURRENCIAS, {
        fechaPago: '2026-10-05',
        montoRecibido: '35000',
        observaciones: '   ',
      }),
    ).not.toHaveProperty('observaciones')
  })
})
