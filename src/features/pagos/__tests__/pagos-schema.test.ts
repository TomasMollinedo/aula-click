import { describe, expect, it } from 'vitest'

import {
  armarRegistrarPago,
  pagoFormSchema,
  parsearMonto,
  valoresInicialesPago,
} from '../pagos.schema'

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
  // Un formulario en efectivo, completo: la base de cada caso.
  const valido = {
    ...valoresInicialesPago('2026-10-05'),
    formaPago: 'EFECTIVO',
    montoRecibido: '35000',
  }
  const transferencia = {
    ...valoresInicialesPago('2026-10-05'),
    formaPago: 'TRANSFERENCIA',
    transferenciaOperacion: '0004829137',
    transferenciaBanco: 'Banco Macro',
    comprobanteAdjuntoId: 18,
  }
  const debito = {
    ...valoresInicialesPago('2026-10-05'),
    formaPago: 'DEBITO',
    debitoRed: 'VISA_DEBITO',
    debitoCupon: '000123',
  }

  function errores(valores: Record<string, unknown>) {
    const resultado = pagoFormSchema.safeParse(valores)
    return resultado.success ? [] : resultado.error.issues.map((i) => [i.path[0], i.message])
  }

  it('acepta el formulario mínimo de cada medio, sin observaciones', () => {
    expect(errores(valido)).toEqual([])
    expect(errores(transferencia)).toEqual([])
    expect(errores(debito)).toEqual([])
  })

  it('sin forma de pago elegida (así abre): "Elegí la forma de pago"', () => {
    expect(errores(valoresInicialesPago('2026-10-05'))).toEqual([
      ['formaPago', 'Elegí la forma de pago'],
    ])
  })

  it('la forma de pago falta aunque la fecha también esté mal: se ven los dos de una vez', () => {
    expect(errores({ ...valoresInicialesPago(''), fechaPago: '05/10/2026' })).toEqual([
      ['fechaPago', 'Fecha inválida: debe tener formato AAAA-MM-DD'],
      ['formaPago', 'Elegí la forma de pago'],
    ])
  })

  it('efectivo: montoRecibido obligatorio; vacío o solo espacios no pasan', () => {
    expect(errores({ ...valido, montoRecibido: '' })).toEqual([
      ['montoRecibido', 'Campo obligatorio'],
    ])
    expect(errores({ ...valido, montoRecibido: '   ' })).toEqual([
      ['montoRecibido', 'Campo obligatorio'],
    ])
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

  it('transferencia: operación, banco y comprobante obligatorios; el titular no', () => {
    expect(
      errores({
        ...transferencia,
        transferenciaOperacion: ' ',
        transferenciaBanco: '',
        comprobanteAdjuntoId: null,
      }),
    ).toEqual([
      ['transferenciaOperacion', 'Campo obligatorio'],
      ['transferenciaBanco', 'Campo obligatorio'],
      ['comprobanteAdjuntoId', 'El comprobante es obligatorio con transferencia'],
    ])
    expect(errores({ ...transferencia, transferenciaTitular: 'Marta López' })).toEqual([])
  })

  it('transferencia: los largos de la API (50, 100 y 100)', () => {
    expect(
      errores({
        ...transferencia,
        transferenciaOperacion: '9'.repeat(51),
        transferenciaBanco: 'b'.repeat(101),
        transferenciaTitular: 't'.repeat(101),
      }),
    ).toEqual([
      ['transferenciaOperacion', 'No puede superar los 50 caracteres'],
      ['transferenciaBanco', 'No puede superar los 100 caracteres'],
      ['transferenciaTitular', 'No puede superar los 100 caracteres'],
    ])
  })

  it('débito: red y cupón obligatorios; cupón sólo números, hasta 20', () => {
    expect(errores({ ...debito, debitoRed: '', debitoCupon: '' })).toEqual([
      ['debitoRed', 'Elegí la red de la tarjeta'],
      ['debitoCupon', 'Campo obligatorio'],
    ])
    expect(errores({ ...debito, debitoCupon: '12A' })).toEqual([
      ['debitoCupon', 'El cupón sólo puede tener números'],
    ])
    expect(errores({ ...debito, debitoCupon: '1'.repeat(21) })).toEqual([
      ['debitoCupon', 'No puede superar los 20 números'],
    ])
  })

  it('débito: últimos 4 opcional, pero si viene, exactamente 4 números; el comprobante, opcional', () => {
    expect(errores({ ...debito, debitoUltimos4: '1234', comprobanteAdjuntoId: 18 })).toEqual([])
    expect(errores({ ...debito, debitoUltimos4: '123' })).toEqual([
      ['debitoUltimos4', 'Tienen que ser exactamente 4 números'],
    ])
    expect(errores({ ...debito, debitoUltimos4: '4509123412341234' })).toEqual([
      ['debitoUltimos4', 'Tienen que ser exactamente 4 números'],
    ])
  })

  it('los campos de otro medio no se miran: lo escrito en efectivo no frena una transferencia', () => {
    expect(errores({ ...transferencia, montoRecibido: 'abc', debitoCupon: 'x' })).toEqual([])
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
  const base = valoresInicialesPago('2026-10-05')
  const efectivo = { ...base, formaPago: 'EFECTIVO' as const, montoRecibido: '35000' }

  it('efectivo: las ocurrencias en el orden en que se muestran, el monto y nada de otro medio', () => {
    const body = armarRegistrarPago(
      12,
      OCURRENCIAS.map((o) => ({ ...o, horaInicio: '09:00', importe: 8000 })),
      {
        ...efectivo,
        observaciones: 'Paga el mes de octubre',
        // Quedó escrito de otro medio: no viaja.
        transferenciaOperacion: '0004829137',
        comprobanteAdjuntoId: 18,
      },
    )
    expect(body).toEqual({
      alumnoId: 12,
      ocurrencias: OCURRENCIAS,
      fechaPago: '2026-10-05',
      formaPago: 'EFECTIVO',
      montoRecibido: 35000,
      observaciones: 'Paga el mes de octubre',
    })
  })

  it('un monto que no se puede leer nunca se omite: viaja 0 y la API lo rechaza', () => {
    const body = armarRegistrarPago(12, OCURRENCIAS, { ...efectivo, montoRecibido: '  ' })
    expect(body).toMatchObject({ formaPago: 'EFECTIVO', montoRecibido: 0 })
  })

  it('monto con coma y puntos de miles: número JSON', () => {
    const body = armarRegistrarPago(12, OCURRENCIAS, { ...efectivo, montoRecibido: '$ 30.000,50' })
    expect(body).toMatchObject({ montoRecibido: 30000.5 })
  })

  it('transferencia: sus datos con trim, el titular sólo si se cargó, y el comprobante; sin monto', () => {
    const body = armarRegistrarPago(12, OCURRENCIAS, {
      ...base,
      formaPago: 'TRANSFERENCIA',
      transferenciaOperacion: ' 0004829137 ',
      transferenciaBanco: ' Banco Macro',
      transferenciaTitular: '  ',
      comprobanteAdjuntoId: 18,
      montoRecibido: '35000',
    })
    expect(body).toEqual({
      alumnoId: 12,
      ocurrencias: OCURRENCIAS,
      fechaPago: '2026-10-05',
      formaPago: 'TRANSFERENCIA',
      transferencia: { operacion: '0004829137', banco: 'Banco Macro' },
      comprobanteAdjuntoId: 18,
    })
  })

  it('débito: red, cupón y últimos 4; el comprobante sólo si se subió', () => {
    const debito = {
      ...base,
      formaPago: 'DEBITO' as const,
      debitoRed: 'VISA_DEBITO' as const,
      debitoCupon: '000123',
      debitoUltimos4: '1234',
    }
    expect(armarRegistrarPago(12, OCURRENCIAS, debito)).toEqual({
      alumnoId: 12,
      ocurrencias: OCURRENCIAS,
      fechaPago: '2026-10-05',
      formaPago: 'DEBITO',
      debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
    })
    expect(
      armarRegistrarPago(12, OCURRENCIAS, {
        ...debito,
        debitoUltimos4: '',
        comprobanteAdjuntoId: 18,
      }),
    ).toMatchObject({ debito: { red: 'VISA_DEBITO', cupon: '000123' }, comprobanteAdjuntoId: 18 })
  })

  it('observaciones con trim; vacías o solo espacios se omiten', () => {
    expect(
      armarRegistrarPago(12, OCURRENCIAS, { ...efectivo, observaciones: '  Efectivo  ' })
        .observaciones,
    ).toBe('Efectivo')
    expect(
      armarRegistrarPago(12, OCURRENCIAS, { ...efectivo, observaciones: '   ' }),
    ).not.toHaveProperty('observaciones')
  })
})
