import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  CAMPOS_BLOQUE,
  interpretarErrorBloque,
  MENSAJE_SIN_AULAS,
  textoErrorBloque,
} from '../errores-bloques'

const CAMPOS = new Set(CAMPOS_BLOQUE)

describe('interpretarErrorBloque', () => {
  it('BLOQUE_SUPERPUESTO: el mensaje y una línea por hora en conflicto', () => {
    const error = new ApiError(
      409,
      'BLOQUE_SUPERPUESTO',
      'El profesor ya tiene un bloque en ese horario',
      [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '10:00', bloqueExistenteId: 5 },
        { diaSemana: 1, horaInicio: '10:00', horaFin: '11:00', bloqueExistenteId: 6 },
      ],
    )

    expect(interpretarErrorBloque(error, CAMPOS)).toEqual({
      mensaje: 'El profesor ya tiene un bloque en ese horario',
      lineas: ['Lunes de 9:00 a 10:00', 'Lunes de 10:00 a 11:00'],
      camposMarcados: [],
    })
  })

  it('AULA_OCUPADA: el mensaje de la HU y las horas ocupadas', () => {
    const error = new ApiError(409, 'AULA_OCUPADA', MENSAJE_SIN_AULAS, [
      { diaSemana: 7, horaInicio: '15:00', horaFin: '16:00', profesorId: 9 },
    ])

    expect(interpretarErrorBloque(error, CAMPOS)).toMatchObject({
      mensaje: MENSAJE_SIN_AULAS,
      lineas: ['Domingo de 15:00 a 16:00'],
    })
  })

  it('ignora los details que no tienen la forma esperada', () => {
    const error = new ApiError(409, 'BLOQUE_SUPERPUESTO', 'Superpuesto', [
      { diaSemana: 9, horaInicio: '09:00', horaFin: '10:00' },
      { algo: 'otro' },
      null,
    ])
    expect(interpretarErrorBloque(error).lineas).toEqual([])
  })

  it('TURNOS_VIGENTES de una hora: la cantidad', () => {
    const error = new ApiError(
      409,
      'TURNOS_VIGENTES',
      'No se puede modificar un bloque con turnos vigentes',
      {
        cantidad: 2,
      },
    )
    expect(interpretarErrorBloque(error)).toEqual({
      mensaje: 'No se puede modificar un bloque con turnos vigentes',
      lineas: ['2 turnos vigentes'],
      camposMarcados: [],
    })
  })

  it('TURNOS_VIGENTES de una sola: en singular', () => {
    const error = new ApiError(409, 'TURNOS_VIGENTES', 'No se puede', { cantidad: 1 })
    expect(interpretarErrorBloque(error).lineas).toEqual(['1 turno vigente'])
  })

  it('TURNOS_VIGENTES de un bloque completo: el mensaje de cada fila afectada', () => {
    const error = new ApiError(
      409,
      'TURNOS_VIGENTES',
      'No se puede modificar un bloque con turnos vigentes',
      [
        {
          path: ['bloqueIds', 2],
          message: 'La hora de 16:00 a 17:00 tiene 2 turnos vigentes',
          cantidad: 2,
        },
      ],
    )
    expect(interpretarErrorBloque(error).lineas).toEqual([
      'La hora de 16:00 a 17:00 tiene 2 turnos vigentes',
    ])
  })

  it.each([
    ['PROFESOR_INACTIVO', 'El profesor está inactivo: no se le puede cargar un bloque'],
    [
      'PROFESOR_SIN_MATERIAS',
      'El profesor no tiene materias asignadas: no se le puede cargar un bloque',
    ],
  ])('%s: solo el mensaje', (code, message) => {
    expect(interpretarErrorBloque(new ApiError(409, code, message), CAMPOS)).toEqual({
      mensaje: message,
      lineas: [],
      camposMarcados: [],
    })
  })

  it('400 VALIDACION: marca los campos del formulario y no deja mensaje general', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', [
      { path: ['horaInicio'], message: 'Debe ser una hora en punto (por ejemplo 14:00)' },
      { path: ['horaFin'], message: 'La hora de fin debe ser posterior a la de inicio' },
    ])
    expect(interpretarErrorBloque(error, CAMPOS)).toEqual({
      mensaje: null,
      lineas: [],
      camposMarcados: [
        { campo: 'horaInicio', mensaje: 'Debe ser una hora en punto (por ejemplo 14:00)' },
        { campo: 'horaFin', mensaje: 'La hora de fin debe ser posterior a la de inicio' },
      ],
    })
  })

  it('400 sobre algo que no es un campo del formulario: al mensaje general', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos de entrada inválidos', [
      { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' },
    ])
    expect(interpretarErrorBloque(error)).toMatchObject({
      mensaje: 'Todas las horas deben ser del mismo profesor',
      camposMarcados: [],
    })
  })

  it('404 de un bloque completo: una línea por fila que ya no existe', () => {
    const error = new ApiError(404, 'NO_ENCONTRADO', 'Bloque no encontrado', [
      { path: ['bloqueIds', 1], message: 'El bloque 99 no existe o ya fue dado de baja' },
    ])
    expect(interpretarErrorBloque(error)).toEqual({
      mensaje: 'Bloque no encontrado',
      lineas: ['El bloque 99 no existe o ya fue dado de baja'],
      camposMarcados: [],
    })
  })

  it('403 SIN_PERMISO: el texto de sin permiso', () => {
    const error = new ApiError(403, 'SIN_PERMISO', 'Forbidden')
    expect(interpretarErrorBloque(error).mensaje).toBe('No tenés permiso para esta operación')
  })

  it('cualquier otro error: su mensaje', () => {
    const error = new ApiError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado')
    expect(interpretarErrorBloque(error)).toEqual({
      mensaje: 'Ocurrió un error inesperado',
      lineas: [],
      camposMarcados: [],
    })
  })
})

describe('textoErrorBloque', () => {
  it('junta el mensaje y las líneas en un texto para un toast', () => {
    const error = new ApiError(
      409,
      'TURNOS_VIGENTES',
      'No se puede modificar un bloque con turnos vigentes',
      {
        cantidad: 3,
      },
    )
    expect(textoErrorBloque(error)).toBe(
      'No se puede modificar un bloque con turnos vigentes: 3 turnos vigentes',
    )
  })

  it('sin líneas, solo el mensaje', () => {
    expect(textoErrorBloque(new ApiError(409, 'PROFESOR_INACTIVO', 'Inactivo'))).toBe('Inactivo')
  })
})
