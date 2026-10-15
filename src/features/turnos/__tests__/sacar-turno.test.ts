import { describe, expect, it } from 'vitest'

import type { BloqueOfertado } from '../mis-turnos.types'
import {
  armarMiTurnoCrear,
  claveBloqueOfertado,
  diasDe,
  profesoresDe,
  sacarTurnoFormSchema,
  textoFechasPortal,
  textoHorasElegidas,
} from '../sacar-turno'

const HORAS = [
  { bloqueId: 12, horaInicio: '10:00' },
  { bloqueId: 11, horaInicio: '09:00' },
]

describe('armarMiTurnoCrear', () => {
  it('una sola clase: la fecha va como fechaInicio, sin fechaFin, y con los temas sin espacios', () => {
    expect(
      armarMiTurnoCrear(
        { materiaId: 3, horas: HORAS },
        { tipo: 'SESION_UNICA', fecha: '2026-10-19', temas: '  Funciones  ' },
        false,
      ),
    ).toEqual({
      materiaId: 3,
      bloqueIds: [11, 12],
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-19',
      temas: 'Funciones',
      asignarDondeHayLugar: false,
    })
  })

  it('todas las semanas sin fin: fechaFin null, sin temas vacíos y sin alumnoId ni observaciones', () => {
    const body = armarMiTurnoCrear(
      { materiaId: 3, horas: [HORAS[1]] },
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-19', fechaFin: '', temas: '   ' },
      true,
    )
    expect(body).toEqual({
      materiaId: 3,
      bloqueIds: [11],
      tipo: 'RECURRENTE',
      fechaInicio: '2026-10-19',
      fechaFin: null,
      asignarDondeHayLugar: true,
    })
    expect(body).not.toHaveProperty('alumnoId')
    expect(body).not.toHaveProperty('observaciones')
  })
})

describe('sacarTurnoFormSchema', () => {
  it('una sola clase exige los temas', () => {
    const resultado = sacarTurnoFormSchema.safeParse({
      tipo: 'SESION_UNICA',
      fecha: '2026-10-19',
      temas: ' ',
    })
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.path).toEqual(['temas'])
  })

  it('todas las semanas: temas y fecha de fin opcionales', () => {
    expect(
      sacarTurnoFormSchema.safeParse({
        tipo: 'RECURRENTE',
        fechaInicio: '2026-10-19',
        fechaFin: '',
      }).success,
    ).toBe(true)
  })

  it('sin fecha: "Elegí una fecha"', () => {
    const resultado = sacarTurnoFormSchema.safeParse({ tipo: 'RECURRENTE', fechaInicio: '' })
    expect(resultado.error?.issues[0]?.message).toBe('Elegí una fecha')
  })
})

const bloque = (profesorId: number, apellido: string, diaSemana: number, ids: number[]) =>
  ({
    profesor: { id: profesorId, nombre: 'N', apellido },
    diaSemana,
    fecha: '2026-10-19',
    aula: { id: 1, nombre: 'Aula 1' },
    horaInicio: '09:00',
    horaFin: '11:00',
    valorPorClase: 8000,
    horas: ids.map((bloqueId) => ({
      bloqueId,
      horaInicio: '09:00',
      horaFin: '10:00',
      disponible: true,
    })),
  }) satisfies BloqueOfertado

describe('selección', () => {
  const bloques = [
    bloque(4, 'Pérez', 3, [20]),
    bloque(4, 'Pérez', 1, [11]),
    bloque(7, 'Ruiz', 1, [30]),
  ]

  it('profesoresDe: sin repetir, en el orden de la API', () => {
    expect(profesoresDe(bloques).map((p) => p.id)).toEqual([4, 7])
  })

  it('diasDe: sin repetir y de lunes a domingo', () => {
    expect(diasDe(bloques)).toEqual([1, 3])
  })

  it('claveBloqueOfertado: los bloqueIds ordenados', () => {
    expect(claveBloqueOfertado(bloque(4, 'Pérez', 1, [12, 11]))).toBe('11-12')
  })
})

describe('textos', () => {
  it('textoHorasElegidas: ordenadas por hora', () => {
    expect(
      textoHorasElegidas([
        { horaInicio: '11:00', horaFin: '12:00' },
        { horaInicio: '09:00', horaFin: '10:00' },
      ]),
    ).toBe('de 9:00 a 10:00 y de 11:00 a 12:00')
  })

  it.each([
    [{ tipo: 'SESION_UNICA', fechaInicio: '2026-10-12' }, 'Una sola clase, el lunes 12/10'],
    [
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: '2026-11-30' },
      'Todas las semanas, desde el lunes 05/10 hasta el lunes 30/11',
    ],
    [
      { tipo: 'RECURRENTE', fechaInicio: '2026-10-05', fechaFin: null },
      'Todas las semanas, desde el lunes 05/10, sin fecha de fin',
    ],
    [{ tipo: 'RECURRENTE', fechaInicio: '2026-10-20', fechaFin: '2026-10-20' }, 'El martes 20/10'],
  ] as const)('textoFechasPortal(%o)', (turno, texto) => {
    expect(textoFechasPortal(turno)).toBe(texto)
  })
})
