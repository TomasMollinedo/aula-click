import { describe, expect, it } from 'vitest'

import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

import { claveDeCelda, paramsDeSemana } from '../calendario'
import {
  armarSemanaDelAlumno,
  fechaDelPrimerTurno,
  filtrarTurnosDelAlumno,
} from '../calendario-alumno'

function turno(parcial: Partial<OcurrenciaDeAlumno> & { turnoId: number }): OcurrenciaDeAlumno {
  return {
    fecha: '2026-10-07',
    diaSemana: 3,
    horaInicio: '14:00',
    horaFin: '15:00',
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    estadoPago: 'PENDIENTE',
    prioridad: null,
    profesor: { id: 1, apellido: 'López', nombre: 'Marta' },
    materia: { id: 1, nombre: 'Matemática' },
    cancelable: true,
    ...parcial,
  }
}

const SIN_FILTROS = { incluirCancelados: false, prioridad: null }

describe('filtrarTurnosDelAlumno', () => {
  const agendado = turno({ turnoId: 1 })
  const sinRegistrar = turno({ turnoId: 2, estado: 'SIN_REGISTRAR', prioridad: 'MEDIA' })
  const cancelado = turno({ turnoId: 3, estado: 'CANCELADO', prioridad: null })
  const todos = [agendado, sinRegistrar, cancelado]

  it('sin filtros deja las agendadas y las sin registrar, como las agendas', () => {
    expect(filtrarTurnosDelAlumno(todos, SIN_FILTROS)).toEqual([agendado, sinRegistrar])
  })

  it('con "incluir cancelados" suma las canceladas', () => {
    expect(filtrarTurnosDelAlumno(todos, { ...SIN_FILTROS, incluirCancelados: true })).toEqual(
      todos,
    )
  })

  it('la prioridad deja solo los turnos de esa prioridad', () => {
    expect(filtrarTurnosDelAlumno(todos, { ...SIN_FILTROS, prioridad: 'MEDIA' })).toEqual([
      sinRegistrar,
    ])
  })

  it('no modifica la lista que recibe', () => {
    const copia = [...todos]
    filtrarTurnosDelAlumno(todos, SIN_FILTROS)
    expect(todos).toEqual(copia)
  })
})

describe('armarSemanaDelAlumno', () => {
  it('una semana sin turnos queda vacía', () => {
    const semana = armarSemanaDelAlumno([], '2026-10-07')

    expect(semana).toMatchObject({ dias: [], horas: [], totalTurnos: 0 })
    expect(semana.celdas.size).toBe(0)
  })

  it('ubica cada turno en la celda de su día y su hora, solo con los días que tienen turnos', () => {
    const semana = armarSemanaDelAlumno(
      [
        turno({
          turnoId: 1,
          fecha: '2026-10-05',
          diaSemana: 1,
          horaInicio: '16:00',
          horaFin: '17:00',
        }),
        turno({ turnoId: 2, fecha: '2026-10-07', horaInicio: '14:00', horaFin: '15:00' }),
      ],
      '2026-10-07',
    )

    expect(semana.dias.map((d) => d.fecha)).toEqual(['2026-10-05', '2026-10-07'])
    expect(semana.totalTurnos).toBe(2)
    expect(semana.celdas.get(claveDeCelda('2026-10-05', 16))?.map((t) => t.turnoId)).toEqual([1])
    expect(semana.celdas.get(claveDeCelda('2026-10-07', 14))?.map((t) => t.turnoId)).toEqual([2])
  })

  it('las horas van de la primera a la última sin saltear ninguna', () => {
    const semana = armarSemanaDelAlumno(
      [
        turno({ turnoId: 1, horaInicio: '10:00', horaFin: '11:00' }),
        turno({
          turnoId: 2,
          fecha: '2026-10-08',
          diaSemana: 4,
          horaInicio: '13:00',
          horaFin: '14:00',
        }),
      ],
      '2026-10-07',
    )

    expect(semana.horas).toEqual([10, 11, 12, 13])
  })

  it('marca el día de hoy y los anteriores', () => {
    const semana = armarSemanaDelAlumno(
      [
        turno({ turnoId: 1, fecha: '2026-10-05', diaSemana: 1 }),
        turno({ turnoId: 2, fecha: '2026-10-07' }),
        turno({ turnoId: 3, fecha: '2026-10-09', diaSemana: 5 }),
      ],
      '2026-10-07',
    )

    expect(semana.dias.map((d) => [d.esPasado, d.esHoy])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ])
  })

  it('dos turnos a la misma hora comparten celda y conservan el orden en que llegan', () => {
    const semana = armarSemanaDelAlumno(
      [turno({ turnoId: 5, estado: 'CANCELADO' }), turno({ turnoId: 6 })],
      '2026-10-07',
    )

    expect(semana.celdas.get(claveDeCelda('2026-10-07', 14))?.map((t) => t.turnoId)).toEqual([5, 6])
  })
})

describe('fechaDelPrimerTurno', () => {
  const HOY = '2026-10-07'

  it('es el primer turno de hoy en adelante, llegue en el orden que llegue', () => {
    const turnos = [
      turno({ turnoId: 1, fecha: '2026-10-21' }),
      turno({ turnoId: 2, fecha: '2026-10-14' }),
      turno({ turnoId: 3, fecha: '2026-09-30' }),
    ]

    expect(fechaDelPrimerTurno(turnos, HOY)).toBe('2026-10-14')
  })

  it('un turno de hoy cuenta', () => {
    expect(fechaDelPrimerTurno([turno({ turnoId: 1, fecha: HOY })], HOY)).toBe(HOY)
  })

  it('si ya no le quedan, es el último que tuvo', () => {
    const turnos = [
      turno({ turnoId: 1, fecha: '2026-03-04' }),
      turno({ turnoId: 2, fecha: '2026-09-30' }),
    ]

    expect(fechaDelPrimerTurno(turnos, HOY)).toBe('2026-09-30')
  })

  it('las canceladas no cuentan', () => {
    const turnos = [
      turno({ turnoId: 1, fecha: '2026-10-08', estado: 'CANCELADO' }),
      turno({ turnoId: 2, fecha: '2026-10-15' }),
    ]

    expect(fechaDelPrimerTurno(turnos, HOY)).toBe('2026-10-15')
  })

  it('sin turnos (o solo cancelados) no hay fecha', () => {
    expect(fechaDelPrimerTurno([], HOY)).toBeNull()
    expect(fechaDelPrimerTurno([turno({ turnoId: 1, estado: 'CANCELADO' })], HOY)).toBeNull()
  })
})

describe('paramsDeSemana con una semana por defecto distinta de hoy', () => {
  // Hoy es miércoles 7 de octubre; el calendario abre en la semana del 19.
  const POR_DEFECTO = '2026-10-21'

  it('la semana por defecto no se escribe en la URL', () => {
    const params = paramsDeSemana(
      new URLSearchParams('fecha=2026-10-05'),
      '2026-10-22',
      POR_DEFECTO,
    )

    expect(params.has('fecha')).toBe(false)
  })

  it('la semana de hoy sí se escribe: "Hoy" no vuelve al turno', () => {
    const params = paramsDeSemana(new URLSearchParams(), '2026-10-07', POR_DEFECTO)

    expect(params.get('fecha')).toBe('2026-10-05')
  })
})
