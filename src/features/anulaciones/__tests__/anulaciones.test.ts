import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  DETALLE_MAX,
  MENSAJE_DETALLE_OBLIGATORIO,
  anulacionFormSchema,
  detalleParaEnviar,
} from '../anulaciones.schema'
import type { PreviaAnulacion } from '../anulaciones.types'
import { interpretarErrorAnulacion } from '../errores-api'
import {
  MENSAJE_ANULADO,
  avisoDeuda,
  avisoPrecio,
  avisoTransferencia,
  lineaPagoCompartido,
  preguntaAnular,
} from '../formato-anulaciones'

const previa: PreviaAnulacion = {
  pago: {
    id: 31,
    numeroComprobante: 123,
    alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
    total: 32000,
    cantidad: 4,
  },
  avisos: { deuda: null, precios: [], transferenciaCompartida: null },
}

describe('anulacionFormSchema', () => {
  it('acepta un motivo sin detalle', () => {
    expect(anulacionFormSchema.safeParse({ motivo: 'ERROR_CARGA', detalle: '' }).success).toBe(true)
  })

  it('sin motivo pide elegirlo', () => {
    const res = anulacionFormSchema.safeParse({ motivo: '', detalle: '' })
    expect(res.error?.issues[0]).toMatchObject({ path: ['motivo'], message: 'Elegí un motivo' })
  })

  it('con "Otro" el detalle es obligatorio, aunque sean espacios', () => {
    for (const detalle of ['', '   ']) {
      const res = anulacionFormSchema.safeParse({ motivo: 'OTRO', detalle })
      expect(res.error?.issues[0]).toMatchObject({
        path: ['detalle'],
        message: MENSAJE_DETALLE_OBLIGATORIO,
      })
    }
    expect(anulacionFormSchema.safeParse({ motivo: 'OTRO', detalle: 'Otro cliente' }).success).toBe(
      true,
    )
  })

  it('el detalle admite hasta 500 caracteres', () => {
    const base = { motivo: 'FORMA_PAGO_EQUIVOCADA' }
    expect(
      anulacionFormSchema.safeParse({ ...base, detalle: 'a'.repeat(DETALLE_MAX) }).success,
    ).toBe(true)
    expect(
      anulacionFormSchema.safeParse({ ...base, detalle: 'a'.repeat(DETALLE_MAX + 1) }).success,
    ).toBe(false)
  })

  it('detalleParaEnviar saca los espacios y omite el vacío', () => {
    expect(detalleParaEnviar('  se cargó mal ')).toBe('se cargó mal')
    expect(detalleParaEnviar('   ')).toBeUndefined()
  })
})

describe('formato de la anulación', () => {
  it('arma la pregunta de confirmación', () => {
    expect(preguntaAnular(previa)).toBe(
      '¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000,00 (4 turnos)?',
    )
    expect(preguntaAnular({ pago: { ...previa.pago, cantidad: 1 } })).toContain('(1 turno)?')
  })

  it('avisa la deuda vencida, con y sin turnos de este pago', () => {
    const alumno = previa.pago.alumno
    expect(avisoDeuda({ cantidad: 5, total: 40000, turnosDelPago: 4 }, alumno)).toBe(
      'Juan Pérez quedaría con deuda vencida: 5 turnos por $ 40.000,00 (4 turnos de este pago)',
    )
    expect(avisoDeuda({ cantidad: 1, total: 0, turnosDelPago: 0 }, alumno)).toBe(
      'Juan Pérez quedaría con deuda vencida: 1 turno por $ 0,00',
    )
  })

  it('avisa el precio distinto, o que la materia ya no tiene precio', () => {
    const materia = { id: 2, nombre: 'Matemática' }
    expect(avisoPrecio({ materia, cobrado: 8000, vigente: 9000 })).toBe(
      'Los turnos de Matemática se volverán a cobrar a $ 9.000,00 por hora; en este pago se cobraron a $ 8.000,00',
    )
    expect(avisoPrecio({ materia, cobrado: 8000, vigente: null })).toContain('ya no tiene precio')
  })

  it('avisa los otros pagos de la misma transferencia', () => {
    const compartida = {
      operacion: '0004829137',
      banco: 'Banco Macro',
      pagos: [
        {
          pagoId: 32,
          numeroComprobante: 124,
          alumno: { id: 14, nombre: 'Lucía', apellido: 'Álvarez' },
        },
      ],
    }
    expect(avisoTransferencia(compartida)).toBe(
      'Hay otro pago vigente con la misma transferencia (operación 0004829137, Banco Macro). No se anulan con éste:',
    )
    expect(
      avisoTransferencia({ ...compartida, pagos: [...compartida.pagos, ...compartida.pagos] }),
    ).toContain('Hay otros 2 pagos vigentes')
    expect(lineaPagoCompartido(compartida.pagos[0]!)).toBe('Comprobante N.º 124 (Lucía Álvarez)')
  })

  it('el mensaje de éxito es el de la HU', () => {
    expect(MENSAJE_ANULADO).toBe('Pago anulado. Sus turnos volvieron a quedar pendientes de pago')
  })
})

describe('interpretarErrorAnulacion', () => {
  it('el 409 es definitivo y trae el mensaje de la API', () => {
    const error = new ApiError(409, 'PAGO_ANULADO', 'Un pago anulado no se puede volver a activar')
    expect(interpretarErrorAnulacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'Un pago anulado no se puede volver a activar',
      definitivo: true,
    })
  })

  it('el 409 TURNOS_DICTADOS también es definitivo y trae el mensaje de la API', () => {
    const error = new ApiError(
      409,
      'TURNOS_DICTADOS',
      'No se puede anular: el pago incluye turnos que ya se dictaron',
      [{ fecha: '2026-10-05', materia: { id: 2, nombre: 'Matemática' }, asistencia: 'PRESENTE' }],
    )
    expect(interpretarErrorAnulacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'No se puede anular: el pago incluye turnos que ya se dictaron',
      definitivo: true,
    })
  })

  it('el 404 es definitivo y el 403 explica el permiso', () => {
    expect(
      interpretarErrorAnulacion(new ApiError(404, 'NO_ENCONTRADO', 'Pago no encontrado')),
    ).toMatchObject({ tipo: 'general', definitivo: true })
    expect(interpretarErrorAnulacion(new ApiError(403, 'SIN_PERMISO', 'x'))).toMatchObject({
      tipo: 'general',
      definitivo: true,
      mensaje: 'No tenés permiso para anular pagos',
    })
  })

  it('el 400 marca los campos del formulario', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['detalle'], message: 'El detalle es obligatorio con "Otro"' },
      { path: ['pagoId'], message: 'Inválido' },
    ])
    expect(interpretarErrorAnulacion(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'detalle', mensaje: 'El detalle es obligatorio con "Otro"' }],
      mensaje: 'Inválido',
    })
  })

  it('un error del servidor se puede reintentar', () => {
    expect(interpretarErrorAnulacion(new ApiError(500, 'ERROR', 'Falló'))).toEqual({
      tipo: 'general',
      mensaje: 'Falló',
      definitivo: false,
    })
  })
})
