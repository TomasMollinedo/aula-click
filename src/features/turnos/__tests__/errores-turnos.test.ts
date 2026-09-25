import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorAlta } from '../errores-turnos'

// `details` copiados de src/server/features/turnos/turnos.ejemplos.ts (el frontend no importa
// `@/server`). Si cambian allá, se cambian acá.

const DETALLE_FECHAS_LLENAS = {
  path: ['bloqueIds', 0],
  message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
  bloqueId: 11,
  horaInicio: '09:00',
  horaFin: '10:00',
  capacidadEfectiva: 6,
  fechas: ['2026-10-26'],
  completoDesde: null,
  sinLugar: false,
}

const DETALLE_SIN_LUGAR = {
  path: ['bloqueIds', 1],
  message: 'La hora de 10:00 a 11:00 no tiene lugar en ninguna de las fechas pedidas',
  bloqueId: 12,
  horaInicio: '10:00',
  horaFin: '11:00',
  capacidadEfectiva: 6,
  fechas: ['2026-10-05', '2026-10-12'],
  completoDesde: '2026-10-19',
  sinLugar: true,
}

const DETALLE_SUPERPUESTO = {
  turnoId: 40,
  tipo: 'RECURRENTE',
  fechaInicio: '2026-09-28',
  fechaFin: null,
  diaSemana: 1,
  horaInicio: '09:00',
  horaFin: '10:00',
  profesor: { id: 7, nombre: 'Sofía', apellido: 'Herrera' },
  materia: { id: 5, nombre: 'Física' },
}

const MENSAJE_FECHAS_SIN_LUGAR =
  'Hay fechas sin lugar: se puede asignar el turno solo en las fechas con lugar, o cancelar'
const MENSAJE_SIN_LUGAR =
  'No hay lugar: alguna de las horas elegidas está completa en todas las fechas pedidas'

function bloqueLleno(message: string, details: unknown) {
  return new ApiError(409, 'BLOQUE_LLENO', message, details)
}

describe('interpretarErrorAlta: BLOQUE_LLENO', () => {
  it('fechas llenas (ninguna hora sinLugar): ofrece asignar igual, con el message de la API', () => {
    expect(
      interpretarErrorAlta(
        bloqueLleno(MENSAJE_FECHAS_SIN_LUGAR, [DETALLE_FECHAS_LLENAS]),
        'RECURRENTE',
      ),
    ).toEqual({
      tipo: 'fechasLlenas',
      mensaje: MENSAJE_FECHAS_SIN_LUGAR,
      lineas: ['La hora de 9:00 a 10:00 está completa el lunes 26/10'],
    })
  })

  it('alguna hora sinLugar: sinLugar, con una línea por hora', () => {
    expect(
      interpretarErrorAlta(
        bloqueLleno(MENSAJE_SIN_LUGAR, [DETALLE_FECHAS_LLENAS, DETALLE_SIN_LUGAR]),
        'RECURRENTE',
      ),
    ).toEqual({
      tipo: 'sinLugar',
      mensaje: MENSAJE_SIN_LUGAR,
      lineas: [DETALLE_FECHAS_LLENAS.message, DETALLE_SIN_LUGAR.message],
    })
  })

  it('sesión única: siempre sinLugar, aunque ningún detalle traiga sinLugar: true', () => {
    // Una sesión única tiene una sola fecha: reenviar con `asignarDondeHayLugar` no cambia nada.
    expect(
      interpretarErrorAlta(
        bloqueLleno(MENSAJE_FECHAS_SIN_LUGAR, [DETALLE_FECHAS_LLENAS]),
        'SESION_UNICA',
      ),
    ).toEqual({
      tipo: 'sinLugar',
      mensaje: MENSAJE_FECHAS_SIN_LUGAR,
      lineas: [DETALLE_FECHAS_LLENAS.message],
    })
  })

  it('sesión única con details malformados: general, igual que en recurrente', () => {
    expect(interpretarErrorAlta(bloqueLleno(MENSAJE_SIN_LUGAR, []), 'SESION_UNICA')).toEqual({
      tipo: 'general',
      mensaje: MENSAJE_SIN_LUGAR,
    })
  })

  it.each([
    ['sin details', undefined],
    ['details vacío', []],
    ['details que no es lista', { cantidad: 2 }],
    ['sin sinLugar', [{ ...DETALLE_FECHAS_LLENAS, sinLugar: undefined }]],
    ['sin message', [{ ...DETALLE_FECHAS_LLENAS, message: 3 }]],
  ])('%s: general con el message', (_, details) => {
    expect(interpretarErrorAlta(bloqueLleno(MENSAJE_SIN_LUGAR, details), 'RECURRENTE')).toEqual({
      tipo: 'general',
      mensaje: MENSAJE_SIN_LUGAR,
    })
  })
})

describe('interpretarErrorAlta: ALUMNO_SUPERPUESTO', () => {
  const mensaje = 'El alumno ya tiene un turno en ese horario'

  it('una línea por turno en conflicto', () => {
    const error = new ApiError(409, 'ALUMNO_SUPERPUESTO', mensaje, [
      DETALLE_SUPERPUESTO,
      {
        ...DETALLE_SUPERPUESTO,
        turnoId: 41,
        tipo: 'SESION_UNICA',
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-12',
        horaInicio: '10:00',
        horaFin: '11:00',
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        materia: { id: 3, nombre: 'Matemática' },
      },
    ])
    expect(interpretarErrorAlta(error, 'SESION_UNICA')).toEqual({
      tipo: 'alumnoSuperpuesto',
      mensaje,
      lineas: [
        'Lunes de 9:00 a 10:00 · Física con Sofía Herrera · recurrente desde el 28/09, sin fin',
        'Lunes de 10:00 a 11:00 · Matemática con Ana Pérez · sesión única del 12/10',
      ],
    })
  })

  it.each([
    ['sin details', undefined],
    ['sin profesor', [{ ...DETALLE_SUPERPUESTO, profesor: null }]],
    ['día fuera de rango', [{ ...DETALLE_SUPERPUESTO, diaSemana: 9 }]],
    ['fecha inválida', [{ ...DETALLE_SUPERPUESTO, fechaInicio: 'x' }]],
  ])('%s: general con el message', (_, details) => {
    const error = new ApiError(409, 'ALUMNO_SUPERPUESTO', mensaje, details)
    expect(interpretarErrorAlta(error, 'RECURRENTE')).toEqual({ tipo: 'general', mensaje })
  })
})

describe('interpretarErrorAlta: 400 VALIDACION', () => {
  const fueraDelDia = 'La fecha debe caer en lunes'

  it('recurrente: fechaInicio y fechaFin en sus campos', () => {
    const error = new ApiError(400, 'VALIDACION', fueraDelDia, [
      { path: ['fechaInicio'], message: fueraDelDia },
      { path: ['fechaFin'], message: fueraDelDia },
    ])
    expect(interpretarErrorAlta(error, 'RECURRENTE')).toEqual({
      tipo: 'campos',
      camposMarcados: [
        { campo: 'fechaInicio', mensaje: fueraDelDia },
        { campo: 'fechaFin', mensaje: fueraDelDia },
      ],
      mensaje: null,
    })
  })

  it('sesión única: fechaInicio (y fechaFin, la misma fecha) van a `fecha`, una sola vez', () => {
    const error = new ApiError(400, 'VALIDACION', fueraDelDia, [
      { path: ['fechaInicio'], message: fueraDelDia },
      { path: ['fechaFin'], message: fueraDelDia },
    ])
    expect(interpretarErrorAlta(error, 'SESION_UNICA')).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'fecha', mensaje: fueraDelDia }],
      mensaje: null,
    })
  })

  it('bloqueIds (con o sin posición) y motivoConsulta', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo día' },
      { path: ['bloqueIds', 1], message: 'No puede repetir horas' },
      { path: ['motivoConsulta'], message: 'No puede superar los 500 caracteres' },
    ])
    expect(interpretarErrorAlta(error, 'RECURRENTE')).toEqual({
      tipo: 'campos',
      camposMarcados: [
        { campo: 'bloqueIds', mensaje: 'Todas las horas deben ser del mismo día' },
        { campo: 'motivoConsulta', mensaje: 'No puede superar los 500 caracteres' },
      ],
      mensaje: null,
    })
  })

  it('lo que no es un campo va al mensaje', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['alumnoId'], message: 'Debe ser mayor a 0' },
      { path: ['fechaInicio'], message: 'La fecha no puede ser anterior a hoy' },
    ])
    expect(interpretarErrorAlta(error, 'RECURRENTE')).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'fechaInicio', mensaje: 'La fecha no puede ser anterior a hoy' }],
      mensaje: 'Debe ser mayor a 0',
    })
  })

  it('sin ningún campo reconocido, o sin details: general', () => {
    expect(
      interpretarErrorAlta(
        new ApiError(400, 'VALIDACION', 'Datos inválidos', [
          { path: ['tipo'], message: 'Tipo inválido' },
        ]),
        'RECURRENTE',
      ),
    ).toEqual({ tipo: 'general', mensaje: 'Tipo inválido' })
    expect(
      interpretarErrorAlta(new ApiError(400, 'VALIDACION', 'Datos inválidos'), 'RECURRENTE'),
    ).toEqual({ tipo: 'general', mensaje: 'Datos inválidos' })
  })
})

describe('interpretarErrorAlta: volver a buscar', () => {
  it.each([
    ['PROFESOR_INACTIVO', 'El profesor está inactivo: no se le pueden asignar turnos', undefined],
    [
      'MATERIA_INACTIVA',
      'La materia está inactiva: no se le pueden asignar turnos',
      [
        {
          path: ['materiaId'],
          message: 'La materia está inactiva: no se le pueden asignar turnos',
        },
      ],
    ],
    [
      'MATERIA_NO_ASIGNADA',
      'La materia no está asignada al profesor',
      [{ path: ['materiaId'], message: 'La materia no está asignada al profesor' }],
    ],
  ])('409 %s', (code, mensaje, details) => {
    expect(interpretarErrorAlta(new ApiError(409, code, mensaje, details), 'RECURRENTE')).toEqual({
      tipo: 'volverABuscar',
      mensaje,
    })
  })

  it('404 de horas (details por posición en bloqueIds)', () => {
    const error = new ApiError(404, 'NO_ENCONTRADO', 'Bloque no encontrado', [
      { path: ['bloqueIds', 0], message: 'Bloque no encontrado' },
    ])
    expect(interpretarErrorAlta(error, 'SESION_UNICA')).toEqual({
      tipo: 'volverABuscar',
      mensaje: 'Bloque no encontrado',
    })
  })
})

describe('interpretarErrorAlta: general', () => {
  it.each([
    [new ApiError(404, 'NO_ENCONTRADO', 'Alumno no encontrado'), 'Alumno no encontrado'],
    [new ApiError(404, 'NO_ENCONTRADO', 'Materia no encontrada'), 'Materia no encontrada'],
    [new ApiError(401, 'NO_AUTENTICADO', 'No autenticado'), 'No autenticado'],
    [new ApiError(403, 'SIN_PERMISO', 'Sin permiso'), 'No tenés permiso para esta operación'],
    [new ApiError(500, 'ERROR_INTERNO', 'Error interno'), 'Error interno'],
    [new ApiError(409, 'CONFLICTO', 'Conflicto'), 'Conflicto'],
  ])('%o', (error, mensaje) => {
    expect(interpretarErrorAlta(error, 'RECURRENTE')).toEqual({ tipo: 'general', mensaje })
  })

  it('error de red (no es un ApiError)', () => {
    const resultado = interpretarErrorAlta(new TypeError('Failed to fetch'), 'RECURRENTE')
    expect(resultado.tipo).toBe('general')
  })
})
