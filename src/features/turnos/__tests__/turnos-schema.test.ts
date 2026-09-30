import { describe, expect, it } from 'vitest'

import { armarTurnoCrear, type SeleccionTurno, turnoFormSchema } from '../turnos.schema'

const SELECCION: SeleccionTurno = {
  alumnoId: 12,
  materiaId: 3,
  // Tildadas en otro orden que el de las horas.
  horas: [
    { bloqueId: 12, horaInicio: '10:00' },
    { bloqueId: 10, horaInicio: '08:00' },
    { bloqueId: 11, horaInicio: '09:00' },
  ],
}

describe('armarTurnoCrear', () => {
  it('sesión única: la fecha va como fechaInicio, sin fechaFin', () => {
    const body = armarTurnoCrear(
      SELECCION,
      {
        tipo: 'SESION_UNICA',
        fecha: '2026-10-05',
        observaciones: 'Viene con el parcial',
        temas: 'Repaso de funciones',
      },
      false,
    )
    expect(body).toEqual({
      alumnoId: 12,
      materiaId: 3,
      bloqueIds: [10, 11, 12],
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-05',
      observaciones: 'Viene con el parcial',
      temas: 'Repaso de funciones',
      asignarDondeHayLugar: false,
    })
    expect(body).not.toHaveProperty('fechaFin')
  })

  it('recurrente con fin', () => {
    const body = armarTurnoCrear(
      SELECCION,
      {
        tipo: 'RECURRENTE',
        fechaInicio: '2026-10-05',
        fechaFin: '2026-11-30',
        observaciones: '',
        temas: '',
      },
      true,
    )
    expect(body).toMatchObject({
      tipo: 'RECURRENTE',
      fechaInicio: '2026-10-05',
      fechaFin: '2026-11-30',
      asignarDondeHayLugar: true,
    })
  })

  it('recurrente sin fin: fechaFin null', () => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '' },
      false,
    )
    expect(body.fechaFin).toBeNull()
    expect(body).toHaveProperty('fechaFin', null)
  })

  it.each(['', '   ', undefined])('observaciones %o: no se mandan', (observaciones) => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'SESION_UNICA', fecha: '2026-10-05', temas: 'Funciones', observaciones },
      false,
    )
    expect(body).not.toHaveProperty('observaciones')
  })

  it.each(['', '   ', undefined])('temas %o en un recurrente: no se mandan', (temas) => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '', temas },
      false,
    )
    expect(body).not.toHaveProperty('temas')
  })

  it('recorta los espacios de observaciones y temas', () => {
    const body = armarTurnoCrear(
      SELECCION,
      {
        tipo: 'SESION_UNICA',
        fecha: '2026-10-05',
        observaciones: '  Repaso  ',
        temas: '  Funciones  ',
      },
      false,
    )
    expect(body.observaciones).toBe('Repaso')
    expect(body.temas).toBe('Funciones')
  })

  it('ordena los bloqueIds por hora, no por id ni por orden de selección', () => {
    const body = armarTurnoCrear(
      {
        ...SELECCION,
        horas: [
          { bloqueId: 3, horaInicio: '14:00' },
          { bloqueId: 9, horaInicio: '09:00' },
        ],
      },
      { tipo: 'SESION_UNICA', fecha: '2026-10-05', temas: 'Funciones' },
      false,
    )
    expect(body.bloqueIds).toEqual([9, 3])
  })
})

describe('turnoFormSchema', () => {
  it('sesión única: exige la fecha', () => {
    const r = turnoFormSchema.safeParse({ tipo: 'SESION_UNICA', fecha: '', temas: 'Funciones' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['fecha'])
  })

  it('recurrente: exige la fecha de inicio; el fin es opcional', () => {
    expect(turnoFormSchema.safeParse({ tipo: 'RECURRENTE', fechaInicio: '' }).success).toBe(false)
    expect(
      turnoFormSchema.safeParse({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '' })
        .success,
    ).toBe(true)
  })

  it.each(['05/10/2026', '2026-13-01', '2026-02-30'])('rechaza la fecha %o', (fecha) => {
    expect(
      turnoFormSchema.safeParse({ tipo: 'SESION_UNICA', fecha, temas: 'Funciones' }).success,
    ).toBe(false)
  })

  it('no valida reglas: acepta un fin anterior al inicio (lo decide la API)', () => {
    expect(
      turnoFormSchema.safeParse({
        tipo: 'RECURRENTE',
        fechaInicio: '2026-10-05',
        fechaFin: '2026-09-28',
      }).success,
    ).toBe(true)
  })

  it.each([undefined, '', '   '])('sesión única: los temas son obligatorios (%o)', (temas) => {
    const r = turnoFormSchema.safeParse({ tipo: 'SESION_UNICA', fecha: '2026-10-05', temas })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['temas'])
  })

  it('recurrente: los temas son opcionales', () => {
    expect(
      turnoFormSchema.safeParse({ tipo: 'RECURRENTE', fechaInicio: '2026-10-05' }).success,
    ).toBe(true)
  })

  it.each(['observaciones', 'temas'] as const)('%s de hasta 500 caracteres', (campo) => {
    const base = { tipo: 'SESION_UNICA', fecha: '2026-10-05', temas: 'Funciones' } as const
    expect(turnoFormSchema.safeParse({ ...base, [campo]: 'a'.repeat(500) }).success).toBe(true)
    expect(turnoFormSchema.safeParse({ ...base, [campo]: 'a'.repeat(501) }).success).toBe(false)
  })
})
