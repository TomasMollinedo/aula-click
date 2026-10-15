import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { errorDeAdjunto, esImagenAdjunta } from '../comprobante-adjunto'

describe('errorDeAdjunto', () => {
  it('400 en `archivo`: junto al campo, con el mensaje de la API', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', [
      { path: ['archivo'], message: 'El archivo supera los 5 MB' },
    ])
    expect(errorDeAdjunto(error)).toEqual({
      enArchivo: true,
      mensaje: 'El archivo supera los 5 MB',
    })
  })

  it.each([
    [409, 'PAGO_ANULADO', 'El pago está anulado'],
    [409, 'CONFLICTO', 'Un pago en efectivo no lleva comprobante adjunto'],
    [409, 'ADJUNTO_OBLIGATORIO', 'Un pago por transferencia no puede quedar sin comprobante'],
    [404, 'NO_ENCONTRADO', 'Pago no encontrado'],
  ])('%s %s: el mensaje de la API, fuera del campo', (status, code, mensaje) => {
    expect(errorDeAdjunto(new ApiError(status, code, mensaje))).toEqual({
      enArchivo: false,
      mensaje,
    })
  })

  it('un 400 que no es del archivo: su mensaje, fuera del campo', () => {
    const error = new ApiError(400, 'VALIDACION', 'Id inválido', [{ path: ['pagoId'] }])
    expect(errorDeAdjunto(error)).toEqual({ enArchivo: false, mensaje: 'Id inválido' })
  })

  it('403: sin permiso', () => {
    expect(errorDeAdjunto(new ApiError(403, 'SIN_PERMISO', 'x'))).toEqual({
      enArchivo: false,
      mensaje: 'No tenés permiso para esta operación',
    })
  })

  it('sin conexión (no es un ApiError): un mensaje genérico', () => {
    expect(errorDeAdjunto(new TypeError('Failed to fetch')).mensaje).toMatch(/conexión/)
  })
})

describe('esImagenAdjunta', () => {
  it.each([
    ['image/jpeg', true],
    ['image/png', true],
    ['application/pdf', false],
  ])('%s → %s', (tipo, esImagen) => {
    expect(esImagenAdjunta(tipo)).toBe(esImagen)
  })
})
