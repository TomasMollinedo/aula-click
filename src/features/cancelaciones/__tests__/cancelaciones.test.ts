import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  DETALLE_MAX,
  MENSAJE_DETALLE_OBLIGATORIO,
  cancelacionFormSchema,
  detalleParaEnviar,
} from '../cancelaciones.schema'
import type { OcurrenciaACancelar } from '../cancelaciones.types'
import { interpretarErrorCancelacion } from '../errores-api'
import { mensajeCancelado, preguntaUna, preguntaVarias } from '../formato-cancelaciones'

const matematica: OcurrenciaACancelar = {
  turnoId: 41,
  fecha: '2026-10-12',
  horaInicio: '09:00',
  horaFin: '10:00',
  materia: { nombre: 'Matemática' },
}
const fisica: OcurrenciaACancelar = {
  turnoId: 57,
  fecha: '2026-10-14',
  horaInicio: '17:00',
  horaFin: '18:00',
  materia: { nombre: 'Física' },
}

describe('cancelacionFormSchema', () => {
  it('acepta un motivo sin detalle', () => {
    expect(
      cancelacionFormSchema.safeParse({ motivo: 'CANCELACION_ALUMNO', detalle: '' }).success,
    ).toBe(true)
  })

  it('sin motivo pide elegirlo', () => {
    const res = cancelacionFormSchema.safeParse({ motivo: '', detalle: '' })
    expect(res.error?.issues[0]).toMatchObject({ path: ['motivo'], message: 'Elegí un motivo' })
  })

  it.each(['', '   '])('"Otro" con detalle %j exige el detalle', (detalle) => {
    const res = cancelacionFormSchema.safeParse({ motivo: 'OTRO', detalle })
    expect(res.error?.issues).toEqual([
      expect.objectContaining({ path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO }),
    ])
  })

  it('"Otro" con detalle es válido', () => {
    expect(cancelacionFormSchema.safeParse({ motivo: 'OTRO', detalle: 'Feriado' }).success).toBe(
      true,
    )
  })

  it('el detalle admite 500 caracteres y no 501', () => {
    const con = (n: number) =>
      cancelacionFormSchema.safeParse({ motivo: 'CANCELACION_PROFESOR', detalle: 'x'.repeat(n) })
    expect(con(DETALLE_MAX).success).toBe(true)
    expect(con(DETALLE_MAX + 1).success).toBe(false)
  })

  it('detalleParaEnviar recorta y omite el vacío', () => {
    expect(detalleParaEnviar('  Viaja ')).toBe('Viaja')
    expect(detalleParaEnviar('   ')).toBeUndefined()
  })
})

describe('mensajes', () => {
  it('la pregunta de una ocurrencia, con y sin alumno', () => {
    expect(preguntaUna(matematica, 'Ana Pérez')).toBe(
      '¿Cancelar el turno de Matemática de Ana Pérez del lunes 12/10 de 9:00 a 10:00?',
    )
    expect(preguntaUna(matematica)).toBe(
      '¿Cancelar el turno de Matemática del lunes 12/10 de 9:00 a 10:00?',
    )
  })

  it('la pregunta de varias lleva la cantidad', () => {
    expect(preguntaVarias(3)).toBe('¿Cancelar 3 turnos?')
  })

  it('el éxito, en singular y plural', () => {
    expect(mensajeCancelado(1)).toBe('Turno cancelado. El lugar quedó disponible.')
    expect(mensajeCancelado(3)).toBe('Se cancelaron 3 turnos. Los lugares quedaron disponibles.')
  })
})

describe('interpretarErrorCancelacion', () => {
  it('409: una línea por ocurrencia rechazada, con el mensaje de la API tal cual', () => {
    const error = new ApiError(
      409,
      'TURNOS_NO_CANCELABLES',
      'Algunos turnos no se pueden cancelar',
      [
        {
          path: ['ocurrencias', 1],
          message: 'El turno está pagado: no se puede cancelar',
          turnoId: 57,
          fecha: '2026-10-14',
          motivo: 'PAGADO',
        },
      ],
    )

    expect(interpretarErrorCancelacion(error, [matematica, fisica])).toEqual({
      tipo: 'noCancelables',
      mensaje: 'Algunos turnos no se pueden cancelar',
      lineas: [
        'Física del miércoles 14/10 de 17:00 a 18:00: El turno está pagado: no se puede cancelar',
      ],
    })
  })

  it('409 sin details (doble cancelación simultánea): sin líneas, con el mensaje', () => {
    const error = new ApiError(
      409,
      'TURNOS_NO_CANCELABLES',
      'Alguno de los turnos ya fue cancelado',
    )
    expect(interpretarErrorCancelacion(error, [matematica])).toEqual({
      tipo: 'noCancelables',
      mensaje: 'Alguno de los turnos ya fue cancelado',
      lineas: [],
    })
  })

  it('400: marca el campo del detalle y deja el resto como mensaje general', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['detalle'], message: 'El detalle es obligatorio cuando el motivo es "Otro"' },
      { path: ['ocurrencias', 0], message: 'Los turnos deben ser del mismo alumno' },
    ])

    expect(interpretarErrorCancelacion(error, [matematica])).toEqual({
      tipo: 'campos',
      camposMarcados: [
        { campo: 'detalle', mensaje: 'El detalle es obligatorio cuando el motivo es "Otro"' },
      ],
      mensaje: 'Los turnos deben ser del mismo alumno',
    })
  })

  it('403 y cualquier otro error caen a un mensaje general', () => {
    expect(
      interpretarErrorCancelacion(new ApiError(403, 'SIN_PERMISO', 'x'), [matematica]),
    ).toEqual({ tipo: 'general', mensaje: 'No tenés permiso para cancelar turnos' })
    expect(interpretarErrorCancelacion(new ApiError(500, 'ERROR', 'Falló'), [matematica])).toEqual({
      tipo: 'general',
      mensaje: 'Falló',
    })
  })
})
