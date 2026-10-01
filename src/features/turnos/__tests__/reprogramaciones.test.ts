import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorReprogramacion } from '../errores-reprogramaciones'
import { textoCambio } from '../formato-reprogramaciones'

describe('textoCambio', () => {
  it('arma el texto de la HU con día, horario y profesor de origen y destino', () => {
    expect(
      textoCambio(
        {
          fecha: '2026-10-12',
          horaInicio: '09:00',
          horaFin: '10:00',
          profesor: { apellido: 'Gómez' },
        },
        {
          fecha: '2026-10-15',
          horaInicio: '17:00',
          horaFin: '18:00',
          profesor: { apellido: 'Ruiz' },
        },
      ),
    ).toBe('Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz')
  })
})

describe('interpretarErrorReprogramacion', () => {
  it('un error que no es de la API cae a un mensaje general', () => {
    expect(interpretarErrorReprogramacion(new TypeError('Failed to fetch'))).toMatchObject({
      tipo: 'general',
    })
  })

  it('409 BLOQUE_LLENO: sin lugar, con una línea por hora', () => {
    const error = new ApiError(409, 'BLOQUE_LLENO', 'La hora está completa', [
      {
        path: ['bloqueAgendaDestinoId'],
        message: 'La hora de 9:00 a 10:00 está completa el jueves 15/10',
        sinLugar: true,
      },
    ])
    expect(interpretarErrorReprogramacion(error)).toEqual({
      tipo: 'sinLugar',
      mensaje: 'La hora está completa',
      lineas: ['La hora de 9:00 a 10:00 está completa el jueves 15/10'],
    })
  })

  it('409 MATERIA_NO_ASIGNADA: hay que volver a buscar', () => {
    const error = new ApiError(409, 'MATERIA_NO_ASIGNADA', 'El profesor ya no dicta la materia')
    expect(interpretarErrorReprogramacion(error)).toEqual({
      tipo: 'volverABuscar',
      mensaje: 'El profesor ya no dicta la materia',
    })
  })

  it('400 sobre fechaDestino se muestra con el mensaje de la API', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['fechaDestino'], message: 'La fecha no cae en el día de la hora' },
    ])
    expect(interpretarErrorReprogramacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'La fecha no cae en el día de la hora',
    })
  })

  it('409 de una ocurrencia cancelada o pasada: mensaje de la API', () => {
    const error = new ApiError(409, 'OCURRENCIA_NO_REPROGRAMABLE', 'El turno ya pasó')
    expect(interpretarErrorReprogramacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'El turno ya pasó',
    })
  })
})
