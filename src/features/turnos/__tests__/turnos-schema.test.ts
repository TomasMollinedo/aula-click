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
      { tipo: 'SESION_UNICA', fecha: '2026-10-05', motivoConsulta: 'Repaso de funciones' },
      false,
    )
    expect(body).toEqual({
      alumnoId: 12,
      materiaId: 3,
      bloqueIds: [10, 11, 12],
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-05',
      motivoConsulta: 'Repaso de funciones',
      asignarDondeHayLugar: false,
    })
    expect(body).not.toHaveProperty('fechaFin')
  })

  it('recurrente con fin', () => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '2026-11-30', motivoConsulta: '' },
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

  it.each(['', '   ', undefined])('motivo %o: no se manda', (motivoConsulta) => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'SESION_UNICA', fecha: '2026-10-05', motivoConsulta },
      false,
    )
    expect(body).not.toHaveProperty('motivoConsulta')
  })

  it('recorta los espacios del motivo', () => {
    const body = armarTurnoCrear(
      SELECCION,
      { tipo: 'SESION_UNICA', fecha: '2026-10-05', motivoConsulta: '  Repaso  ' },
      false,
    )
    expect(body.motivoConsulta).toBe('Repaso')
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
      { tipo: 'SESION_UNICA', fecha: '2026-10-05' },
      false,
    )
    expect(body.bloqueIds).toEqual([9, 3])
  })
})

describe('turnoFormSchema', () => {
  it('sesión única: exige la fecha', () => {
    const r = turnoFormSchema.safeParse({ tipo: 'SESION_UNICA', fecha: '' })
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
    expect(turnoFormSchema.safeParse({ tipo: 'SESION_UNICA', fecha }).success).toBe(false)
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

  it('motivo de hasta 500 caracteres', () => {
    const base = { tipo: 'SESION_UNICA', fecha: '2026-10-05' } as const
    expect(turnoFormSchema.safeParse({ ...base, motivoConsulta: 'a'.repeat(500) }).success).toBe(
      true,
    )
    expect(turnoFormSchema.safeParse({ ...base, motivoConsulta: 'a'.repeat(501) }).success).toBe(
      false,
    )
  })
})
