import { describe, expect, it } from 'vitest'
import {
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_MAXIMO,
  clasesDelPeriodo,
  instantesDelPeriodo,
  materiasConMasDemanda,
  ocupacion,
  porcentaje,
  problemaDelPeriodo,
  turnosPorEstado,
  type OcurrenciaTablero,
} from '../tablero.reglas'

// Reglas puras del tablero (T-61). Hoy: viernes 02/10/2026.

const HOY = '2026-10-02'

const MATERIAS: Record<number, string> = {
  1: 'Álgebra',
  2: 'Matemática',
  3: 'Física',
  4: 'Química',
  5: 'Inglés',
  6: 'Lengua',
  7: 'Biología',
}

function ocurrencia(
  fecha: string,
  estado: OcurrenciaTablero['estado'],
  { bloqueAgendaId = 10, materiaId = 2 }: { bloqueAgendaId?: number; materiaId?: number } = {},
): OcurrenciaTablero {
  return {
    fecha,
    estado,
    bloqueAgendaId,
    materia: { id: materiaId, nombre: MATERIAS[materiaId] ?? `Materia ${materiaId}` },
  }
}

const repetir = (cantidad: number, crear: () => OcurrenciaTablero) =>
  Array.from({ length: cantidad }, crear)

describe('problemaDelPeriodo', () => {
  it('un solo día y un período en orden → se puede', () => {
    expect(problemaDelPeriodo('2026-10-02', '2026-10-02')).toBeNull()
    expect(problemaDelPeriodo('2026-09-28', '2026-10-04')).toBeNull()
  })

  it('`hasta` anterior a `desde` → rango invertido', () => {
    expect(problemaDelPeriodo('2026-10-02', '2026-10-01')).toBe(MENSAJE_RANGO_INVERTIDO)
  })

  it('366 días, extremos incluidos, cruzando el 29 de febrero → se puede', () => {
    expect(problemaDelPeriodo('2028-01-01', '2028-12-31')).toBeNull()
  })

  it('367 días → supera el tope', () => {
    expect(problemaDelPeriodo('2028-01-01', '2029-01-01')).toBe(MENSAJE_RANGO_MAXIMO)
  })

  it('un año no bisiesto más un día son 366 → se puede; uno más, no', () => {
    expect(problemaDelPeriodo('2026-01-01', '2027-01-01')).toBeNull()
    expect(problemaDelPeriodo('2026-01-01', '2027-01-02')).toBe(MENSAJE_RANGO_MAXIMO)
  })
})

describe('porcentaje', () => {
  it('redondea a un decimal', () => {
    expect(porcentaje(1, 3)).toBe(33.3)
    expect(porcentaje(2, 3)).toBe(66.7)
    expect(porcentaje(1, 8)).toBe(12.5)
    expect(porcentaje(1, 2)).toBe(50)
  })

  it('los extremos: 0 y 100', () => {
    expect(porcentaje(0, 5)).toBe(0)
    expect(porcentaje(5, 5)).toBe(100)
  })

  it('base 0 → 0, sin dividir por cero', () => {
    expect(porcentaje(0, 0)).toBe(0)
    expect(porcentaje(3, 0)).toBe(0)
  })

  it('no recorta a 100', () => {
    expect(porcentaje(3, 2)).toBe(150)
  })
})

describe('turnosPorEstado', () => {
  it('cuenta cada estado sobre el total, incluidas las canceladas', () => {
    const turnos = turnosPorEstado(
      [
        ocurrencia('2026-09-30', 'CANCELADO'),
        ocurrencia('2026-10-01', 'SIN_REGISTRAR'),
        ocurrencia('2026-10-02', 'AGENDADO'),
      ],
      { hasta: '2026-10-04', hoy: HOY },
    )

    expect(turnos).toEqual({
      total: 3,
      cancelados: { cantidad: 1, porcentaje: 33.3 },
      sinRegistrar: { cantidad: 1, porcentaje: 33.3 },
      agendados: { cantidad: 1, porcentaje: 33.3 },
    })
  })

  it('período sólo pasado (`hasta` anterior a hoy) → `agendados: null`', () => {
    const turnos = turnosPorEstado([ocurrencia('2026-09-30', 'SIN_REGISTRAR')], {
      hasta: '2026-10-01',
      hoy: HOY,
    })

    expect(turnos.agendados).toBeNull()
    expect(turnos.sinRegistrar).toEqual({ cantidad: 1, porcentaje: 100 })
  })

  it('`hasta` es hoy → el período incluye hoy: `agendados` con su cantidad, aunque sea 0', () => {
    const turnos = turnosPorEstado([ocurrencia('2026-10-01', 'SIN_REGISTRAR')], {
      hasta: HOY,
      hoy: HOY,
    })

    expect(turnos.agendados).toEqual({ cantidad: 0, porcentaje: 0 })
  })

  it('sin ocurrencias → todo en 0', () => {
    expect(turnosPorEstado([], { hasta: '2026-10-04', hoy: HOY })).toEqual({
      total: 0,
      cancelados: { cantidad: 0, porcentaje: 0 },
      sinRegistrar: { cantidad: 0, porcentaje: 0 },
      agendados: { cantidad: 0, porcentaje: 0 },
    })
  })
})

describe('clasesDelPeriodo', () => {
  it('una clase por hora de bloque y fecha, aunque tenga varios alumnos', () => {
    expect(
      clasesDelPeriodo([
        ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
        ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
        ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 11 }),
        ocurrencia('2026-10-05', 'AGENDADO', { bloqueAgendaId: 10 }),
      ]),
    ).toEqual([
      { bloqueAgendaId: 10, fecha: '2026-09-28' },
      { bloqueAgendaId: 11, fecha: '2026-09-28' },
      { bloqueAgendaId: 10, fecha: '2026-10-05' },
    ])
  })

  it('una hora con todos sus turnos cancelados no es una clase; con uno no cancelado, sí', () => {
    expect(
      clasesDelPeriodo([
        ocurrencia('2026-09-28', 'CANCELADO', { bloqueAgendaId: 10 }),
        ocurrencia('2026-09-28', 'CANCELADO', { bloqueAgendaId: 10 }),
        ocurrencia('2026-09-29', 'CANCELADO', { bloqueAgendaId: 11 }),
        ocurrencia('2026-09-29', 'SIN_REGISTRAR', { bloqueAgendaId: 11 }),
      ]),
    ).toEqual([{ bloqueAgendaId: 11, fecha: '2026-09-29' }])
  })
})

describe('ocupacion', () => {
  it('turnos no cancelados sobre la suma de la capacidad de cada clase', () => {
    const resultado = ocupacion(
      [
        // Clase del bloque 10 (capacidad 4) con dos alumnos: su capacidad cuenta una vez.
        ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
        ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
        // Otra fecha del mismo bloque: otra clase.
        ocurrencia('2026-10-05', 'AGENDADO', { bloqueAgendaId: 10 }),
        // Clase del bloque 11 (capacidad 2), con un cancelado que no suma a los turnos.
        ocurrencia('2026-09-29', 'SIN_REGISTRAR', { bloqueAgendaId: 11 }),
        ocurrencia('2026-09-29', 'CANCELADO', { bloqueAgendaId: 11 }),
        // Hora con todos cancelados (capacidad 6): no entra al denominador.
        ocurrencia('2026-09-30', 'CANCELADO', { bloqueAgendaId: 12 }),
      ],
      new Map([
        [10, 4],
        [11, 2],
        [12, 6],
      ]),
    )

    expect(resultado).toEqual({ turnos: 4, capacidad: 10, porcentaje: 40 })
  })

  it('sin clases → todo en 0', () => {
    expect(ocupacion([], new Map())).toEqual({ turnos: 0, capacidad: 0, porcentaje: 0 })
    expect(ocupacion([ocurrencia('2026-09-28', 'CANCELADO')], new Map([[10, 4]]))).toEqual({
      turnos: 0,
      capacidad: 0,
      porcentaje: 0,
    })
  })

  it('no recorta a 100: una clase con más turnos que su capacidad actual da el valor real', () => {
    const resultado = ocupacion(
      repetir(3, () => ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 })),
      new Map([[10, 2]]),
    )

    expect(resultado).toEqual({ turnos: 3, capacidad: 2, porcentaje: 150 })
  })

  it('un bloque sin capacidad conocida suma 0', () => {
    expect(ocupacion([ocurrencia('2026-09-28', 'SIN_REGISTRAR')], new Map())).toEqual({
      turnos: 1,
      capacidad: 0,
      porcentaje: 0,
    })
  })
})

describe('materiasConMasDemanda', () => {
  const de = (materiaId: number, cantidad: number, estado: OcurrenciaTablero['estado']) =>
    repetir(cantidad, () => ocurrencia('2026-09-28', estado, { materiaId }))

  it('hasta 5, por cantidad descendente', () => {
    const top = materiasConMasDemanda([
      ...de(4, 1, 'AGENDADO'),
      ...de(2, 6, 'SIN_REGISTRAR'),
      ...de(3, 5, 'SIN_REGISTRAR'),
      ...de(5, 4, 'AGENDADO'),
      ...de(6, 3, 'AGENDADO'),
      ...de(7, 2, 'AGENDADO'),
    ])

    expect(top).toEqual([
      { materia: { id: 2, nombre: 'Matemática' }, cantidad: 6 },
      { materia: { id: 3, nombre: 'Física' }, cantidad: 5 },
      { materia: { id: 5, nombre: 'Inglés' }, cantidad: 4 },
      { materia: { id: 6, nombre: 'Lengua' }, cantidad: 3 },
      { materia: { id: 7, nombre: 'Biología' }, cantidad: 2 },
    ])
  })

  it('empate → por nombre en español (la tilde no manda al final) y después por id', () => {
    const top = materiasConMasDemanda([
      ...de(2, 2, 'AGENDADO'),
      ...de(7, 2, 'AGENDADO'),
      ...de(1, 2, 'AGENDADO'),
      ocurrencia('2026-09-28', 'AGENDADO', { materiaId: 90 }),
      {
        ...ocurrencia('2026-09-28', 'AGENDADO', { materiaId: 80 }),
        materia: { id: 80, nombre: 'Materia 90' },
      },
    ])

    expect(top.map((item) => item.materia.id)).toEqual([1, 7, 2, 80, 90])
  })

  it('las canceladas no cuentan: una materia sólo con canceladas no aparece', () => {
    const top = materiasConMasDemanda([
      ...de(2, 1, 'SIN_REGISTRAR'),
      ...de(2, 3, 'CANCELADO'),
      ...de(3, 5, 'CANCELADO'),
    ])

    expect(top).toEqual([{ materia: { id: 2, nombre: 'Matemática' }, cantidad: 1 }])
  })

  it('sin ocurrencias → vacío', () => {
    expect(materiasConMasDemanda([])).toEqual([])
  })
})

describe('instantesDelPeriodo', () => {
  const dentro = (instante: string, rango: { desde: Date; hasta: Date }) => {
    const t = new Date(instante).getTime()
    return t >= rango.desde.getTime() && t < rango.hasta.getTime()
  }

  it('el día de Salta (UTC−3, sin horario de verano) empieza a las 03:00Z', () => {
    const rango = instantesDelPeriodo('2026-09-28', '2026-10-04')

    expect(rango.desde.toISOString()).toBe('2026-09-28T03:00:00.000Z')
    expect(rango.hasta.toISOString()).toBe('2026-10-05T03:00:00.000Z')
  })

  it('tampoco cambia en enero: Salta no tiene horario de verano', () => {
    const rango = instantesDelPeriodo('2026-01-15', '2026-01-15')

    expect(rango.desde.toISOString()).toBe('2026-01-15T03:00:00.000Z')
    expect(rango.hasta.toISOString()).toBe('2026-01-16T03:00:00.000Z')
  })

  it('medianoche en Salta: las 23:30 de `hasta` entran y las 00:30 del día siguiente no', () => {
    const rango = instantesDelPeriodo('2026-09-28', '2026-10-04')

    // 23:30 del 04/10 en Salta = 02:30Z del 05/10; 00:30 del 05/10 en Salta = 03:30Z.
    expect(dentro('2026-10-05T02:30:00.000Z', rango)).toBe(true)
    expect(dentro('2026-10-05T03:30:00.000Z', rango)).toBe(false)
  })

  it('medianoche en Salta al empezar: las 23:30 del día anterior a `desde` no entran y las 00:00 sí', () => {
    const rango = instantesDelPeriodo('2026-09-28', '2026-10-04')

    expect(dentro('2026-09-28T02:30:00.000Z', rango)).toBe(false)
    expect(dentro('2026-09-28T03:00:00.000Z', rango)).toBe(true)
  })

  it('el fin es exclusivo y cruza de mes y de año', () => {
    const rango = instantesDelPeriodo('2026-12-31', '2026-12-31')

    expect(rango.hasta.toISOString()).toBe('2027-01-01T03:00:00.000Z')
    expect(dentro('2027-01-01T03:00:00.000Z', rango)).toBe(false)
  })
})
