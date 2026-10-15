import { describe, expect, it } from 'vitest'
import { AppError, ValidationError } from '@/server/errors'
import { OBSERVACION_CIERRE_SISTEMA } from '@/server/features/turnos/ocurrencias.condiciones'
import {
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_MAXIMO,
  armarGrupos,
  armarMisMaterias,
  bloquesDelPortal,
  estaCerradaPorSistema,
  mesEnCurso,
  opcionesDeLosGrupos,
  porcentajeAsistencia,
  rangoDelMes,
  resumirHoras,
  validarPeriodo,
  type OcurrenciaHistorial,
} from '../historiales.reglas'

// Reglas puras del historial académico (T-108): el período, la agrupación por materia y profesor,
// los bloques de horas seguidas, el resumen y el porcentaje. No tocan Prisma ni `hoy()`: las
// ocurrencias llegan ya calculadas por el motor de `turnos` (T-74).

const HOY = '2026-10-15'

/** Ejecuta `accion`, que debe lanzar, y devuelve el error. */
function errorDe(accion: () => unknown): unknown {
  try {
    accion()
  } catch (error) {
    return error
  }
  return expect.fail('Se esperaba un error')
}

/** Una ocurrencia como la arma el motor (horas en minutos, fechas `YYYY-MM-DD`). */
function hora(
  datos: Partial<OcurrenciaHistorial> & Pick<OcurrenciaHistorial, 'turnoId' | 'fecha'>,
): OcurrenciaHistorial {
  return {
    horaInicio: 480,
    horaFin: 540,
    alumnoId: 12,
    profesorId: 4,
    materiaId: 3,
    estado: 'REALIZADO',
    asistencia: null,
    plazoAsistencia: { vence: '2026-10-20', vencido: false },
    materia: { id: 3, nombre: 'Matemática' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    ...datos,
  }
}

/** Una asistencia presente con sus textos, como la trae `Ocurrencia.asistencia`. */
function presente(trabajado: string | null, indicaciones: string | null) {
  return {
    estado: 'PRESENTE' as const,
    trabajado,
    indicaciones,
    observacion: null,
    createdById: 'usr_ana',
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedById: 'usr_ana',
    updatedAt: '2026-10-13T12:00:00.000Z',
  }
}

/** Una asistencia ausente con su observación. */
function ausente(observacion: string | null) {
  return {
    estado: 'AUSENTE' as const,
    trabajado: null,
    indicaciones: null,
    observacion,
    createdById: 'usr_ana',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedById: 'usr_ana',
    updatedAt: '2026-10-07T12:00:00.000Z',
  }
}

// ---------------------------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------------------------

describe('rangoDelMes y mesEnCurso', () => {
  it('un mes de 31 días, uno de 30 y febrero de un año bisiesto', () => {
    expect(rangoDelMes('2026-10')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(rangoDelMes('2026-11')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    expect(rangoDelMes('2024-02')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' })
    expect(rangoDelMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })

  it('diciembre cierra el año sin pasarse al siguiente', () => {
    expect(rangoDelMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })

  it('el mes en curso es el de hoy, completo', () => {
    expect(mesEnCurso(HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })
})

describe('validarPeriodo', () => {
  it('acepta un período en orden y de hasta 366 días', () => {
    expect(() => validarPeriodo('2026-10-01', '2026-10-31')).not.toThrow()
    expect(() => validarPeriodo(HOY, HOY)).not.toThrow()
    // 366 días exactos, extremos incluidos.
    expect(() => validarPeriodo('2026-01-01', '2027-01-01')).not.toThrow()
  })

  it('`hasta` anterior a `desde`: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarPeriodo('2026-10-15', '2026-10-14'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as AppError).message).toBe(MENSAJE_RANGO_INVERTIDO)
    expect((error as AppError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO },
    ])
  })

  it('más de 366 días: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarPeriodo('2026-01-01', '2027-01-02'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as AppError).message).toBe(MENSAJE_RANGO_MAXIMO)
    expect((error as AppError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_MAXIMO },
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// Porcentaje y resumen
// ---------------------------------------------------------------------------------------------

describe('porcentajeAsistencia', () => {
  it('presentes sobre presentes más ausentes, con un decimal', () => {
    expect(porcentajeAsistencia(3, 1)).toBe(75)
    expect(porcentajeAsistencia(1, 2)).toBe(33.3)
    expect(porcentajeAsistencia(2, 1)).toBe(66.7)
    expect(porcentajeAsistencia(4, 0)).toBe(100)
  })

  it('0 sin base (ninguna realizada ni ausente)', () => {
    expect(porcentajeAsistencia(0, 0)).toBe(0)
  })
})

describe('resumirHoras', () => {
  it('no cuenta los cancelados, los sin registrar ni los agendados', () => {
    expect(
      resumirHoras([
        hora({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
        hora({ turnoId: 2, fecha: '2026-10-07', estado: 'AUSENTE' }),
        hora({ turnoId: 3, fecha: '2026-10-08', estado: 'CANCELADO' }),
        hora({ turnoId: 4, fecha: '2026-10-09', estado: 'SIN_REGISTRAR' }),
        hora({ turnoId: 5, fecha: HOY, estado: 'AGENDADO' }),
      ]),
    ).toEqual({ realizadas: 1, ausencias: 1, porcentaje: 50 })
  })
})

describe('estaCerradaPorSistema', () => {
  it('sólo un "Sin registrar" con el plazo vencido', () => {
    expect(
      estaCerradaPorSistema({
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-10-01', vencido: true },
      }),
    ).toBe(true)
    expect(
      estaCerradaPorSistema({
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-10-20', vencido: false },
      }),
    ).toBe(false)
    expect(
      estaCerradaPorSistema({
        estado: 'AUSENTE',
        plazoAsistencia: { vence: '2026-10-01', vencido: true },
      }),
    ).toBe(false)
    expect(estaCerradaPorSistema({ estado: 'CANCELADO', plazoAsistencia: null })).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
// armarGrupos
// ---------------------------------------------------------------------------------------------

describe('armarGrupos', () => {
  it('agrupa por materia y profesor, por nombre de materia y apellido del profesor', () => {
    const grupos = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-06' }),
      hora({
        turnoId: 2,
        fecha: '2026-10-07',
        profesorId: 9,
        profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz' },
      }),
      hora({
        turnoId: 3,
        fecha: '2026-10-08',
        materiaId: 5,
        materia: { id: 5, nombre: 'Lengua' },
      }),
    ])

    expect(grupos).toHaveLength(3)
    expect(grupos.map((grupo) => [grupo.materia.nombre, grupo.profesor.apellido])).toEqual([
      ['Lengua', 'Pérez'],
      ['Matemática', 'Pérez'],
      ['Matemática', 'Ruiz'],
    ])
  })

  it('tres horas seguidas son un bloque con tres clases, los textos una vez y cuentan tres', () => {
    const textos = presente('Ecuaciones', 'Practicar la guía')
    const [grupo] = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-13', horaInicio: 480, horaFin: 540, asistencia: textos }),
      hora({ turnoId: 2, fecha: '2026-10-13', horaInicio: 540, horaFin: 600, asistencia: textos }),
      hora({ turnoId: 3, fecha: '2026-10-13', horaInicio: 600, horaFin: 660, asistencia: textos }),
    ])

    expect(grupo.bloques).toHaveLength(1)
    const [bloque] = grupo.bloques
    expect(bloque).toMatchObject({
      fecha: '2026-10-13',
      horaInicio: '08:00',
      horaFin: '11:00',
      horas: 3,
      textos: { trabajado: 'Ecuaciones', indicaciones: 'Practicar la guía' },
    })
    expect(bloque.clases.map((clase) => clase.turnoId)).toEqual([1, 2, 3])
    // Los textos van una sola vez: ninguna hora los repite en `textosPropios`.
    expect(bloque.clases.every((clase) => clase.textosPropios === null)).toBe(true)
    expect(grupo.resumen).toEqual({ realizadas: 3, ausencias: 0, porcentaje: 100 })
  })

  it('una hora del bloque con otros textos trae sus `textosPropios`', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-10-13',
        horaInicio: 480,
        horaFin: 540,
        asistencia: presente('Ecuaciones', 'Practicar la guía'),
      }),
      hora({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        asistencia: presente('Ecuaciones y verificación', 'Practicar la guía'),
      }),
    ])

    const [bloque] = grupo.bloques
    expect(bloque.textos).toEqual({ trabajado: 'Ecuaciones', indicaciones: 'Practicar la guía' })
    expect(bloque.clases[0].textosPropios).toBeNull()
    expect(bloque.clases[1].textosPropios).toEqual({
      trabajado: 'Ecuaciones y verificación',
      indicaciones: 'Practicar la guía',
    })
  })

  it('una hora cancelada en el medio corta el bloque y es un bloque propio con su motivo', () => {
    const [grupo] = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-13', horaInicio: 480, horaFin: 540 }),
      hora({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        estado: 'CANCELADO',
        plazoAsistencia: null,
        cancelacion: {
          motivo: 'CANCELACION_ALUMNO',
          detalle: 'Viaje familiar',
          createdById: 'usr_mesa',
          createdAt: '2026-10-10T12:00:00.000Z',
        },
      }),
      hora({ turnoId: 3, fecha: '2026-10-13', horaInicio: 600, horaFin: 660 }),
    ])

    // Tres bloques de una hora: la cancelada no se une a ninguna y corta la cadena.
    expect(grupo.bloques.map((bloque) => [bloque.horaInicio, bloque.horas])).toEqual([
      ['10:00', 1],
      ['09:00', 1],
      ['08:00', 1],
    ])
    const cancelada = grupo.bloques[1].clases[0]
    expect(cancelada.estado).toBe('CANCELADO')
    expect(cancelada.cancelacion).toEqual({
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Viaje familiar',
    })
    // Cancelada y sin registrar no cuentan: sólo las dos realizadas.
    expect(grupo.resumen).toEqual({ realizadas: 2, ausencias: 0, porcentaje: 100 })
  })

  it('un "Sin registrar" vencido viene cerrado por el sistema, con su observación', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-09-20',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-09-27', vencido: true },
      }),
    ])

    const clase = grupo.bloques[0].clases[0]
    expect(clase.cerradaPorSistema).toBe(true)
    expect(clase.observacion).toBe(OBSERVACION_CIERRE_SISTEMA)
    expect(clase.plazoAsistencia).toEqual({ vence: '2026-09-27', vencido: true })
  })

  it('un "Sin registrar" dentro del plazo no está cerrado y no trae observación', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-10-13',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-10-20', vencido: false },
      }),
    ])

    const clase = grupo.bloques[0].clases[0]
    expect(clase.cerradaPorSistema).toBe(false)
    expect(clase.observacion).toBeNull()
  })

  it('una ausencia trae su observación y no los textos del bloque', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-10-07',
        estado: 'AUSENTE',
        asistencia: ausente('Avisó la madre: estaba con fiebre'),
      }),
    ])

    const clase = grupo.bloques[0].clases[0]
    expect(clase.observacion).toBe('Avisó la madre: estaba con fiebre')
    expect(clase.textosPropios).toBeNull()
    expect(grupo.bloques[0].textos).toBeNull()
  })

  it('los bloques van de la fecha más reciente a la más antigua', () => {
    const [grupo] = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-06' }),
      hora({ turnoId: 2, fecha: '2026-10-13' }),
      hora({ turnoId: 3, fecha: '2026-09-29' }),
    ])

    expect(grupo.bloques.map((bloque) => bloque.fecha)).toEqual([
      '2026-10-13',
      '2026-10-06',
      '2026-09-29',
    ])
  })

  it('sin ocurrencias no hay grupos', () => {
    expect(armarGrupos([])).toEqual([])
  })
})

describe('opcionesDeLosGrupos', () => {
  it('materias y profesores de los grupos, sin repetir y ordenados', () => {
    const grupos = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-06' }),
      hora({ turnoId: 2, fecha: '2026-10-07' }),
      hora({
        turnoId: 3,
        fecha: '2026-10-08',
        materiaId: 5,
        materia: { id: 5, nombre: 'Lengua' },
        profesorId: 9,
        profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz' },
      }),
    ])

    expect(opcionesDeLosGrupos(grupos)).toEqual({
      materias: [
        { id: 5, nombre: 'Lengua' },
        { id: 3, nombre: 'Matemática' },
      ],
      profesores: [
        { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        { id: 9, nombre: 'Diego', apellido: 'Ruiz' },
      ],
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------------------------

describe('bloquesDelPortal', () => {
  it('saca las clases "Sin registrar" y agendadas, y el bloque que se queda vacío', () => {
    const [grupo] = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-13', horaInicio: 480, horaFin: 540 }),
      hora({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        estado: 'SIN_REGISTRAR',
      }),
      hora({ turnoId: 3, fecha: HOY, estado: 'AGENDADO', plazoAsistencia: null }),
    ])

    const bloques = bloquesDelPortal(grupo.bloques)
    // El bloque de hoy (agendado) desaparece; del otro queda sólo la hora realizada.
    expect(bloques).toHaveLength(1)
    expect(bloques[0].clases.map((clase) => clase.turnoId)).toEqual([1])
    expect(bloques[0].horas).toBe(2)
  })

  it('no publica la observación, el motivo de la cancelación, el plazo ni el cierre', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-10-07',
        estado: 'AUSENTE',
        asistencia: ausente('Observación interna'),
      }),
      hora({
        turnoId: 2,
        fecha: '2026-10-08',
        estado: 'CANCELADO',
        plazoAsistencia: null,
        cancelacion: {
          motivo: 'CANCELACION_PROFESOR',
          detalle: 'Paro de transporte',
          createdById: 'usr_mesa',
          createdAt: '2026-10-07T12:00:00.000Z',
        },
      }),
    ])

    const clases = bloquesDelPortal(grupo.bloques).flatMap((bloque) => bloque.clases)
    expect(clases.map((clase) => clase.estado)).toEqual(['CANCELADO', 'AUSENTE'])
    expect(JSON.stringify(clases)).not.toContain('Observación interna')
    expect(JSON.stringify(clases)).not.toContain('Paro de transporte')
    expect(Object.keys(clases[0])).toEqual([
      'turnoId',
      'fecha',
      'horaInicio',
      'horaFin',
      'estado',
      'textosPropios',
    ])
  })

  it('conserva los textos del bloque y los propios de la hora que los tenga', () => {
    const [grupo] = armarGrupos([
      hora({
        turnoId: 1,
        fecha: '2026-10-13',
        horaInicio: 480,
        horaFin: 540,
        asistencia: presente('Ecuaciones', null),
      }),
      hora({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        asistencia: presente('Ecuaciones', 'Traer la guía'),
      }),
    ])

    const [bloque] = bloquesDelPortal(grupo.bloques)
    expect(bloque.textos).toEqual({ trabajado: 'Ecuaciones', indicaciones: null })
    expect(bloque.clases[1].textosPropios).toEqual({
      trabajado: 'Ecuaciones',
      indicaciones: 'Traer la guía',
    })
  })
})

describe('armarMisMaterias', () => {
  it('cada materia y profesor con su porcentaje y su próximo turno no cancelado', () => {
    const grupos = armarGrupos([
      hora({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
      hora({ turnoId: 1, fecha: '2026-10-07', estado: 'AUSENTE' }),
    ])
    const futuras = [
      hora({ turnoId: 1, fecha: '2026-10-20', estado: 'CANCELADO', plazoAsistencia: null }),
      hora({ turnoId: 1, fecha: '2026-10-27', estado: 'AGENDADO', plazoAsistencia: null }),
    ]

    expect(armarMisMaterias(grupos, futuras)).toEqual([
      {
        materia: { id: 3, nombre: 'Matemática' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        proximoTurno: { fecha: '2026-10-27', horaInicio: '08:00', horaFin: '09:00' },
        porcentaje: 50,
      },
    ])
  })

  it('sin turnos próximos, `proximoTurno` es null', () => {
    const grupos = armarGrupos([hora({ turnoId: 1, fecha: '2026-10-06' })])

    expect(armarMisMaterias(grupos, [])[0]).toMatchObject({
      proximoTurno: null,
      porcentaje: 100,
    })
  })

  it('una materia y profesor cuyo único turno todavía no pasó aparece con porcentaje 0', () => {
    const futuras = [
      hora({
        turnoId: 7,
        fecha: '2026-10-20',
        estado: 'AGENDADO',
        plazoAsistencia: null,
        materiaId: 5,
        materia: { id: 5, nombre: 'Lengua' },
      }),
    ]

    expect(armarMisMaterias([], futuras)).toEqual([
      {
        materia: { id: 5, nombre: 'Lengua' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        proximoTurno: { fecha: '2026-10-20', horaInicio: '08:00', horaFin: '09:00' },
        porcentaje: 0,
      },
    ])
  })
})
