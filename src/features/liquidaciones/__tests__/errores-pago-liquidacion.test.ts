import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  errorDeSubidaComprobante,
  interpretarErrorPagoLiquidacion,
} from '../errores-pago-liquidacion'

// Mensajes copiados de docs/contrato-api.md → Liquidaciones y Adjuntos (el frontend no importa
// `@/server`). Si cambian allá, se cambian acá.

const MENSAJE_ADJUNTO = 'El comprobante de la transferencia no existe o ya se usó: volvé a subirlo'

describe('interpretarErrorPagoLiquidacion', () => {
  it('400 VALIDACION en campos del formulario: cada uno en el suyo', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['fechaTransferencia'], message: 'La fecha de la transferencia no puede ser futura' },
      { path: ['numeroOperacion'], message: 'Campo obligatorio' },
    ])
    expect(interpretarErrorPagoLiquidacion(error)).toEqual({
      tipo: 'campos',
      campos: [
        {
          campo: 'fechaTransferencia',
          mensaje: 'La fecha de la transferencia no puede ser futura',
        },
        { campo: 'numeroOperacion', mensaje: 'Campo obligatorio' },
      ],
      mensaje: null,
    })
  })

  it('400 ADJUNTO_INVALIDO: al campo "Comprobante"', () => {
    const error = new ApiError(400, 'ADJUNTO_INVALIDO', MENSAJE_ADJUNTO, [
      { path: ['comprobanteAdjuntoId'], message: MENSAJE_ADJUNTO },
    ])
    expect(interpretarErrorPagoLiquidacion(error)).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'comprobanteAdjuntoId', mensaje: MENSAJE_ADJUNTO }],
      mensaje: null,
    })
  })

  it('un detalle que no es de un campo va al mensaje suelto', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['numeroOperacion'], message: 'Campo obligatorio' },
      { path: ['totalConfirmado'], message: 'Debe ser mayor a 0' },
    ])
    expect(interpretarErrorPagoLiquidacion(error)).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'numeroOperacion', mensaje: 'Campo obligatorio' }],
      mensaje: 'Debe ser mayor a 0',
    })
  })

  it('sin ningún campo del formulario: general con el primer detalle', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['mes'], message: 'El mes no puede ser futuro' },
    ])
    expect(interpretarErrorPagoLiquidacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'El mes no puede ser futuro',
    })
  })

  it('400 sin details con la forma de Zod: general con el message', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', { algo: 1 })
    expect(interpretarErrorPagoLiquidacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'Datos inválidos',
    })
  })

  it('409 LIQUIDACION_MODIFICADA: modificada', () => {
    const mensaje = 'La liquidación cambió desde que la abriste. Revisala antes de pagar'
    expect(
      interpretarErrorPagoLiquidacion(new ApiError(409, 'LIQUIDACION_MODIFICADA', mensaje)),
    ).toEqual({ tipo: 'modificada', mensaje })
  })

  it.each([
    [409, 'LIQUIDACION_PAGADA', 'La liquidación de octubre de 2026 de Gómez, Ana ya está pagada'],
    [409, 'CONFLICTO', 'No hay importe a pagar'],
    [
      409,
      'CONFLICTO',
      'La liquidación de noviembre de 2026 todavía no se puede pagar: el mes no terminó',
    ],
    [404, 'NO_ENCONTRADO', 'Profesor no encontrado'],
  ])('%s %s: conflicto con el message', (status, code, mensaje) => {
    expect(interpretarErrorPagoLiquidacion(new ApiError(status, code, mensaje))).toEqual({
      tipo: 'conflicto',
      mensaje,
    })
  })

  it('403: sin permiso', () => {
    expect(interpretarErrorPagoLiquidacion(new ApiError(403, 'SIN_PERMISO', 'x'))).toEqual({
      tipo: 'general',
      mensaje: 'No tenés permiso para esta operación',
    })
  })

  it('error de red: sin conexión', () => {
    expect(interpretarErrorPagoLiquidacion(new TypeError('Failed to fetch'))).toEqual({
      tipo: 'general',
      mensaje: 'No se pudo registrar el pago. Revisá la conexión e intentá de nuevo.',
    })
  })

  it('500: general con el message', () => {
    expect(
      interpretarErrorPagoLiquidacion(new ApiError(500, 'ERROR_INTERNO', 'Error interno')),
    ).toEqual({ tipo: 'general', mensaje: 'Error interno' })
  })
})

describe('errorDeSubidaComprobante', () => {
  it('400 en ["archivo"]: el mensaje de ese detalle', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['archivo'], message: 'El archivo debe ser JPG, PNG o PDF' },
    ])
    expect(errorDeSubidaComprobante(error)).toBe('El archivo debe ser JPG, PNG o PDF')
  })

  it('403: sin permiso', () => {
    expect(errorDeSubidaComprobante(new ApiError(403, 'SIN_PERMISO', 'x'))).toBe(
      'No tenés permiso para esta operación',
    )
  })

  it('red: sin conexión', () => {
    expect(errorDeSubidaComprobante(new TypeError('Failed to fetch'))).toBe(
      'No se pudo completar la operación. Revisá la conexión e intentá de nuevo.',
    )
  })

  it('el resto: el message de la API', () => {
    expect(errorDeSubidaComprobante(new ApiError(400, 'VALIDACION', 'Datos inválidos', []))).toBe(
      'Datos inválidos',
    )
  })
})
