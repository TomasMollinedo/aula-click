import { describe, expect, it, vi } from 'vitest'
import { asistenciasDeOcurrencias, ultimasIndicaciones } from '../asistencias.condiciones'

type Cliente = Parameters<typeof ultimasIndicaciones>[0]

// `ultimasIndicaciones` (T-81, la usa también T-108): una sola consulta para todas las filas y la
// última por alumno, materia y fecha límite. Sin base: el cliente es un mock.

const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function cliente(filas: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(filas)
  return {
    findMany,
    client: { asistenciaTurno: { findMany } } as unknown as Cliente,
  }
}

// Como las devuelve la base: de la más nueva a la más vieja.
const filas = [
  {
    fechaOcurrencia: fecha('2026-10-13'),
    indicaciones: 'Hoy no',
    turno: { alumnoId: 12, materiaId: 3 },
  },
  {
    fechaOcurrencia: fecha('2026-10-07'),
    indicaciones: 'Repasar',
    turno: { alumnoId: 12, materiaId: 3 },
  },
  {
    fechaOcurrencia: fecha('2026-10-06'),
    indicaciones: 'Otra materia',
    turno: { alumnoId: 12, materiaId: 4 },
  },
]

describe('ultimasIndicaciones', () => {
  it('una sola consulta para todas y la última anterior a cada fecha, alineada con items', async () => {
    const { client, findMany } = cliente(filas)

    const resultado = await ultimasIndicaciones(client, [
      { alumnoId: 12, materiaId: 3, antesDe: '2026-10-13' },
      { alumnoId: 12, materiaId: 4, antesDe: '2026-10-13' },
      { alumnoId: 99, materiaId: 3, antesDe: '2026-10-13' },
    ])

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(resultado).toEqual([
      { fecha: '2026-10-07', indicaciones: 'Repasar' },
      { fecha: '2026-10-06', indicaciones: 'Otra materia' },
      null,
    ])
  })

  it('sólo busca asistencias PRESENTE con indicaciones, antes de cada fecha', async () => {
    const { client, findMany } = cliente([])

    await ultimasIndicaciones(client, [{ alumnoId: 12, materiaId: 3, antesDe: '2026-10-13' }])

    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      estado: 'PRESENTE',
      indicaciones: { not: null },
      OR: [
        {
          fechaOcurrencia: { lt: fecha('2026-10-13') },
          turno: { alumnoId: 12, materiaId: 3 },
        },
      ],
    })
  })

  it('sin items no consulta', async () => {
    const { client, findMany } = cliente([])

    expect(await ultimasIndicaciones(client, [])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

// `asistenciasDeOcurrencias` (T-179): qué ocurrencias de un pago ya se dictaron. Una sola consulta
// por el único `(turnoId, fechaOcurrencia)`.
describe('asistenciasDeOcurrencias', () => {
  it('una sola consulta por turno y fecha; devuelve sólo las que tienen asistencia, con su estado', async () => {
    const { client, findMany } = cliente([
      { turnoId: 41, fechaOcurrencia: fecha('2026-10-05'), estado: 'PRESENTE' },
      { turnoId: 50, fechaOcurrencia: fecha('2026-10-06'), estado: 'AUSENTE' },
    ])

    const resultado = await asistenciasDeOcurrencias(client, [
      { turnoId: 41, fecha: '2026-10-05' },
      { turnoId: 41, fecha: '2026-10-12' },
      { turnoId: 50, fecha: '2026-10-06' },
    ])

    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        OR: [
          { turnoId: 41, fechaOcurrencia: fecha('2026-10-05') },
          { turnoId: 41, fechaOcurrencia: fecha('2026-10-12') },
          { turnoId: 50, fechaOcurrencia: fecha('2026-10-06') },
        ],
      },
      select: { turnoId: true, fechaOcurrencia: true, estado: true },
    })
    expect(resultado).toEqual([
      { turnoId: 41, fecha: '2026-10-05', estado: 'PRESENTE' },
      { turnoId: 50, fecha: '2026-10-06', estado: 'AUSENTE' },
    ])
  })

  it('sin ocurrencias no consulta', async () => {
    const { client, findMany } = cliente([])

    expect(await asistenciasDeOcurrencias(client, [])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
