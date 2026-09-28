import { describe, expect, it } from 'vitest'

import type { TurnoVigenteProfesor } from '../profesores.types'
import {
  resumenTurnosVigentes,
  rutaAgendaDelSegmento,
  textoResumenTurnos,
  textoVigencia,
} from '../turnos-vigentes'

// Los turnos vigentes que impiden la baja de un profesor, preparados para mostrarlos.
// 2026-09-28 es lunes; 2026-09-29, martes.

const turno = (
  alumnoId: number,
  extra: Partial<TurnoVigenteProfesor> = {},
): TurnoVigenteProfesor => ({
  alumno: { id: alumnoId, nombre: 'Lucía', apellido: 'González' },
  materia: { id: 3, nombre: 'Matemática' },
  tipo: 'SESION_UNICA',
  fecha: '2026-09-28',
  fechaFin: '2026-09-28',
  horaInicio: '09:00',
  horaFin: '10:00',
  ...extra,
})

describe('resumenTurnosVigentes', () => {
  it('cuenta los turnos, los alumnos distintos y la última fecha', () => {
    const turnos = [
      turno(1),
      turno(1, { fechaFin: '2026-11-30', tipo: 'RECURRENTE' }),
      turno(2, { fechaFin: '2026-10-05' }),
    ]

    expect(resumenTurnosVigentes(turnos)).toEqual({ turnos: 3, alumnos: 2, hasta: '2026-11-30' })
  })

  it('sin fecha de fin conocida (recurrente sin fin), `hasta` es null', () => {
    expect(resumenTurnosVigentes([turno(1, { tipo: 'RECURRENTE', fechaFin: null })]).hasta).toBe(
      null,
    )
  })

  it('sin turnos, todo en cero', () => {
    expect(resumenTurnosVigentes([])).toEqual({ turnos: 0, alumnos: 0, hasta: null })
  })
})

describe('textoVigencia', () => {
  it('sesión única: el día y la fecha', () => {
    expect(textoVigencia(turno(1))).toBe('el lunes 28/09, de 9:00 a 10:00')
  })

  it('recurrente con fin: el día de la semana y hasta cuándo', () => {
    expect(textoVigencia(turno(1, { tipo: 'RECURRENTE', fechaFin: '2026-11-30' }))).toBe(
      'los lunes de 9:00 a 10:00, hasta el 30/11',
    )
  })

  it('recurrente sin fin: lo dice', () => {
    expect(
      textoVigencia(turno(1, { tipo: 'RECURRENTE', fechaFin: null, fecha: '2026-09-29' })),
    ).toBe('los martes de 9:00 a 10:00, sin fecha de fin')
  })

  it('pluraliza sábado y domingo, y deja igual los días que ya terminan en s', () => {
    // 2026-10-03 es sábado; 2026-10-04, domingo.
    const sabado = turno(1, { tipo: 'RECURRENTE', fecha: '2026-10-03', fechaFin: '2026-10-24' })
    const domingo = turno(1, { tipo: 'RECURRENTE', fecha: '2026-10-04', fechaFin: null })

    expect(textoVigencia(sabado)).toBe('los sábados de 9:00 a 10:00, hasta el 24/10')
    expect(textoVigencia(domingo)).toBe('los domingos de 9:00 a 10:00, sin fecha de fin')
    // En singular, el día no se pluraliza.
    expect(textoVigencia(turno(1, { fecha: '2026-10-03', fechaFin: '2026-10-03' }))).toBe(
      'el sábado 03/10, de 9:00 a 10:00',
    )
  })
})

describe('textoResumenTurnos', () => {
  it('resume cuántos turnos, cuántos alumnos y hasta cuándo', () => {
    const turnos = [
      turno(1, { fechaFin: '2026-11-30' }),
      turno(2, { fechaFin: '2026-10-05' }),
      turno(3, { fechaFin: '2026-10-05' }),
    ]

    expect(textoResumenTurnos('Lorenzo Ríos', turnos)).toBe(
      'Lorenzo Ríos tiene 3 turnos vigentes con 3 alumnos, hasta el 30/11.',
    )
  })

  it('con un solo turno y un solo alumno, en singular', () => {
    expect(textoResumenTurnos('Ana Pérez', [turno(1)])).toBe(
      'Ana Pérez tiene 1 turno vigente con 1 alumno, hasta el 28/09.',
    )
  })

  it('con un recurrente sin fin, avisa que no hay última fecha', () => {
    const turnos = [turno(1, { tipo: 'RECURRENTE', fechaFin: null })]

    expect(textoResumenTurnos('Ana Pérez', turnos)).toBe(
      'Ana Pérez tiene 1 turno vigente con 1 alumno, y alguno sin fecha de fin.',
    )
  })
})

describe('rutaAgendaDelSegmento', () => {
  it('lleva a la agenda del mismo segmento de rol', () => {
    expect(rutaAgendaDelSegmento('/mesa/profesores')).toBe('/mesa/agenda')
    expect(rutaAgendaDelSegmento('/gerente/profesores')).toBe('/gerente/agenda')
  })

  it('tolera una barra al final', () => {
    expect(rutaAgendaDelSegmento('/mesa/profesores/')).toBe('/mesa/agenda')
  })
})
