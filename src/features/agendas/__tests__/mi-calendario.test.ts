import { describe, expect, it } from 'vitest'

import type { OcurrenciaDelPortal } from '@/types/ocurrencia'

import { armarSemanaDelAlumno } from '../calendario-alumno'
import { claveDeCelda } from '../calendario'
import {
  agruparMisTurnosPorDia,
  filtrarMisTurnos,
  modoPorDefectoDeMiCalendario,
} from '../mi-calendario'

function turno(parcial: Partial<OcurrenciaDelPortal> & { turnoId: number }): OcurrenciaDelPortal {
  return {
    fecha: '2026-10-14',
    diaSemana: 3,
    horaInicio: '14:00',
    horaFin: '15:00',
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    estadoPago: 'PENDIENTE',
    profesor: { id: 1, apellido: 'López', nombre: 'Marta' },
    materia: { id: 1, nombre: 'Matemática' },
    aula: { id: 1, nombre: 'Aula 1' },
    ...parcial,
  }
}

const HOY = '2026-10-14'

describe('modoPorDefectoDeMiCalendario', () => {
  it('en el celular abre la lista', () => {
    expect(modoPorDefectoDeMiCalendario(true)).toBe('lista')
  })

  it('en una pantalla grande abre el calendario', () => {
    expect(modoPorDefectoDeMiCalendario(false)).toBe('calendario')
  })
})

describe('agruparMisTurnosPorDia', () => {
  it('sin turnos no hay días', () => {
    expect(agruparMisTurnosPorDia([], HOY)).toEqual([])
  })

  it('agrupa por día en orden y, dentro de cada uno, por hora', () => {
    const dias = agruparMisTurnosPorDia(
      [
        turno({ turnoId: 1, fecha: '2026-10-15', horaInicio: '16:00' }),
        turno({ turnoId: 2, fecha: '2026-10-13', horaInicio: '10:00' }),
        turno({ turnoId: 3, fecha: '2026-10-15', horaInicio: '09:00' }),
      ],
      HOY,
    )
    expect(dias.map((d) => d.fecha)).toEqual(['2026-10-13', '2026-10-15'])
    expect(dias[1].turnos.map((t) => t.turnoId)).toEqual([3, 1])
  })

  it('marca hoy y los días pasados', () => {
    const dias = agruparMisTurnosPorDia(
      [
        turno({ turnoId: 1, fecha: '2026-10-13' }),
        turno({ turnoId: 2, fecha: HOY }),
        turno({ turnoId: 3, fecha: '2026-10-16' }),
      ],
      HOY,
    )
    expect(dias.map(({ esHoy, esPasado }) => ({ esHoy, esPasado }))).toEqual([
      { esHoy: false, esPasado: true },
      { esHoy: true, esPasado: false },
      { esHoy: false, esPasado: false },
    ])
  })

  it('deja las canceladas', () => {
    const dias = agruparMisTurnosPorDia(
      [turno({ turnoId: 1, estado: 'CANCELADO' }), turno({ turnoId: 2, horaInicio: '15:00' })],
      HOY,
    )
    expect(dias[0].turnos.map((t) => t.estado)).toEqual(['CANCELADO', 'AGENDADO'])
  })
})

describe('armarSemanaDelAlumno con los turnos del portal', () => {
  it('ubica cada turno en su día y hora, canceladas incluidas', () => {
    const semana = armarSemanaDelAlumno(
      [turno({ turnoId: 1 }), turno({ turnoId: 2, estado: 'CANCELADO', horaInicio: '16:30' })],
      HOY,
    )
    expect(semana.totalTurnos).toBe(2)
    expect(semana.horas).toEqual([14, 15, 16])
    expect(semana.celdas.get(claveDeCelda(HOY, 16))?.[0].aula.nombre).toBe('Aula 1')
    expect(semana.dias[0].esHoy).toBe(true)
  })
})

describe('filtrarMisTurnos', () => {
  const turnos = [turno({ turnoId: 1 }), turno({ turnoId: 2, estado: 'CANCELADO' })]

  it('sin incluir cancelados, saca las canceladas', () => {
    expect(filtrarMisTurnos(turnos, false).map((t) => t.turnoId)).toEqual([1])
  })

  it('incluyendo cancelados, quedan todas', () => {
    expect(filtrarMisTurnos(turnos, true).map((t) => t.turnoId)).toEqual([1, 2])
  })
})
