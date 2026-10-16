import { describe, expect, it } from 'vitest'

import {
  armarPagoLiquidacion,
  pagoLiquidacionFormSchema,
  valoresInicialesPagoLiquidacion,
} from '../pago-liquidacion.schema'

const validos = {
  ...valoresInicialesPagoLiquidacion('2026-11-03'),
  numeroOperacion: '0004829137',
}

function erroresDe(valores: unknown) {
  const resultado = pagoLiquidacionFormSchema.safeParse(valores)
  if (resultado.success) return {}
  return Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('valoresInicialesPagoLiquidacion', () => {
  it('la fecha en hoy y el resto vacío', () => {
    expect(valoresInicialesPagoLiquidacion('2026-11-03')).toEqual({
      fechaTransferencia: '2026-11-03',
      numeroOperacion: '',
      comprobanteAdjuntoId: null,
      observaciones: '',
    })
  })
})

describe('pagoLiquidacionFormSchema', () => {
  it('acepta lo mínimo: fecha y número de operación', () => {
    expect(pagoLiquidacionFormSchema.safeParse(validos).success).toBe(true)
  })

  it('acepta un comprobante subido y observaciones', () => {
    const valores = { ...validos, comprobanteAdjuntoId: 44, observaciones: 'Octubre' }
    expect(pagoLiquidacionFormSchema.safeParse(valores).success).toBe(true)
  })

  it('marca todo lo que falta de una vez', () => {
    expect(erroresDe({ ...validos, fechaTransferencia: '', numeroOperacion: '   ' })).toEqual({
      fechaTransferencia: 'Campo obligatorio',
      numeroOperacion: 'Campo obligatorio',
    })
  })

  it.each([
    ['03/11/2026', 'Fecha inválida: debe tener formato AAAA-MM-DD'],
    ['2026-02-30', 'La fecha no es válida'],
  ])('fecha %s: %s', (fechaTransferencia, mensaje) => {
    expect(erroresDe({ ...validos, fechaTransferencia })).toEqual({ fechaTransferencia: mensaje })
  })

  it('el número de operación hasta 50 caracteres (sin contar los espacios de alrededor)', () => {
    expect(erroresDe({ ...validos, numeroOperacion: ` ${'1'.repeat(50)} ` })).toEqual({})
    expect(erroresDe({ ...validos, numeroOperacion: '1'.repeat(51) })).toEqual({
      numeroOperacion: 'No puede superar los 50 caracteres',
    })
  })

  it('las observaciones hasta 500 caracteres', () => {
    expect(erroresDe({ ...validos, observaciones: 'a'.repeat(501) })).toEqual({
      observaciones: 'No puede superar los 500 caracteres',
    })
  })
})

describe('armarPagoLiquidacion', () => {
  it('arma el body con el total de la liquidación como totalConfirmado', () => {
    expect(
      armarPagoLiquidacion(
        {
          ...validos,
          numeroOperacion: '  0004829137 ',
          comprobanteAdjuntoId: 44,
          observaciones: ' Pago de octubre ',
        },
        81600,
      ),
    ).toEqual({
      fechaTransferencia: '2026-11-03',
      numeroOperacion: '0004829137',
      comprobanteAdjuntoId: 44,
      observaciones: 'Pago de octubre',
      totalConfirmado: 81600,
    })
  })

  it('sin comprobante ni observaciones (vacías o solo espacios): null', () => {
    expect(armarPagoLiquidacion({ ...validos, observaciones: '   ' }, 81600)).toMatchObject({
      comprobanteAdjuntoId: null,
      observaciones: null,
    })
  })
})
