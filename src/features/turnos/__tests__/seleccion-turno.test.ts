import { describe, expect, it } from 'vitest'

import { agruparTurnosPorHora, buscarBloque, claveBloque, tildadasLlenas } from '../seleccion-turno'
import type { BloqueDisponible, HoraDisponible, TurnoDetalle } from '../turnos.types'

function hora(bloqueId: number, horaInicio: string, lleno = false): HoraDisponible {
  const h = Number(horaInicio.slice(0, 2)) + 1
  return {
    bloqueId,
    horaInicio,
    horaFin: `${String(h).padStart(2, '0')}:00`,
    capacidadEfectiva: 6,
    ocupacion: lleno ? 6 : 2,
    lleno,
  }
}

function bloque(fecha: string, horas: HoraDisponible[]): BloqueDisponible {
  return {
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    diaSemana: 1,
    fecha,
    aula: { id: 3, nombre: 'Aula 3' },
    horaInicio: horas[0]?.horaInicio ?? '08:00',
    horaFin: horas.at(-1)?.horaFin ?? '09:00',
    horas,
  }
}

describe('claveBloque y buscarBloque', () => {
  it('la clave son los bloqueIds ordenados, sin importar la fecha ni la ocupación', () => {
    const a = bloque('2026-09-28', [hora(11, '09:00'), hora(10, '08:00')])
    const b = bloque('2026-10-05', [hora(10, '08:00', true), hora(11, '09:00')])
    expect(claveBloque(a)).toBe('10-11')
    expect(claveBloque(b)).toBe(claveBloque(a))
  })

  it('busca el resultado con las mismas horas', () => {
    const otro = bloque('2026-10-05', [hora(20, '14:00')])
    const mismo = bloque('2026-10-05', [hora(10, '08:00'), hora(11, '09:00')])
    expect(buscarBloque([otro, mismo], '10-11')).toBe(mismo)
  })

  it('sin match (otras horas, lista vacía o sin datos): null', () => {
    const parcial = bloque('2026-10-05', [hora(10, '08:00')])
    expect(buscarBloque([parcial], '10-11')).toBeNull()
    expect(buscarBloque([], '10-11')).toBeNull()
    expect(buscarBloque(undefined, '10-11')).toBeNull()
  })
})

describe('tildadasLlenas', () => {
  it('solo las tildadas que la API marca lleno', () => {
    const b = bloque('2026-10-05', [
      hora(10, '08:00', true),
      hora(11, '09:00', true),
      hora(12, '10:00', false),
    ])
    expect(tildadasLlenas(b, [11, 12]).map((h) => h.bloqueId)).toEqual([11])
    expect(tildadasLlenas(b, [])).toEqual([])
  })
})

describe('agruparTurnosPorHora', () => {
  const base = {
    tipo: 'RECURRENTE',
    estado: 'ACTIVO',
    diaSemana: 1,
    alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    motivoConsulta: null,
    createdAt: '2026-09-24T13:45:00.000Z',
    updatedAt: '2026-09-24T13:45:00.000Z',
    createdBy: null,
    updatedBy: null,
  } as const

  function turno(
    id: number,
    bloqueId: number,
    horaInicio: string,
    fechaInicio: string,
    fechaFin: string | null,
  ): TurnoDetalle {
    return {
      ...base,
      id,
      bloqueId,
      horaInicio,
      horaFin: horaInicio.replace(/^(\d\d)/, (h) => String(Number(h) + 1).padStart(2, '0')),
      fechaInicio,
      fechaFin,
    }
  }

  it('una hora con dos tramos y otra con uno, en el orden de la API', () => {
    const grupos = agruparTurnosPorHora([
      turno(55, 11, '09:00', '2026-10-05', '2026-10-19'),
      turno(56, 11, '09:00', '2026-11-02', '2026-11-30'),
      turno(57, 13, '11:00', '2026-10-05', '2026-11-30'),
    ])
    expect(grupos.map((g) => [g.bloqueId, g.horaInicio, g.tramos.map((t) => t.id)])).toEqual([
      [11, '09:00', [55, 56]],
      [13, '11:00', [57]],
    ])
    expect(grupos[0]?.horaFin).toBe('10:00')
  })

  it('sin turnos: vacío', () => {
    expect(agruparTurnosPorHora([])).toEqual([])
  })
})
