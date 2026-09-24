import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  condicionTurnoOcupaLugar,
  condicionTurnoVigente,
  turnosRepository,
} from '../turnos.repository'

// Única implementación de "turno vigente" (docs/dominio.md → Turnos). Sin base: Prisma se
// reemplaza por un mock y se verifica la condición que recibe. Que Postgres la evalúe bien lo
// garantiza el `gte` sobre una columna @db.Date.

const { groupBy, count } = vi.hoisted(() => ({ groupBy: vi.fn(), count: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { turno: { groupBy, count } } }))

const HOY = '2026-09-22'
const MEDIANOCHE_HOY = new Date('2026-09-22T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  groupBy.mockResolvedValue([])
  count.mockResolvedValue(0)
})

describe('condicionTurnoVigente', () => {
  it('solo turnos ACTIVO (un cancelado no cuenta)', () => {
    expect(condicionTurnoVigente(HOY).estado).toBe('ACTIVO')
  })

  it('recurrente sin fecha de fin, o con fin >= hoy (incluye el que termina exactamente hoy)', () => {
    expect(condicionTurnoVigente(HOY).OR).toEqual([
      { fechaFin: null },
      { fechaFin: { gte: MEDIANOCHE_HOY } },
    ])
  })

  it('una sesión única (fechaFin = fechaInicio) de hoy cumple fin >= hoy; la de ayer no', () => {
    const { gte } = condicionTurnoVigente(HOY).OR[1].fechaFin as { gte: Date }
    expect(new Date('2026-09-22T00:00:00.000Z') >= gte).toBe(true)
    expect(new Date('2026-09-21T00:00:00.000Z') >= gte).toBe(false)
  })
})

describe('contarVigentesPorMateria', () => {
  it('filtra por profesor (el del bloque) y materias, agrupa por materia y devuelve la cantidad', async () => {
    groupBy.mockResolvedValue([
      { materiaId: 2, _count: { _all: 3 } },
      { materiaId: 7, _count: { _all: 1 } },
    ])

    const resultado = await turnosRepository.contarVigentesPorMateria({
      fechaHoy: HOY,
      profesorId: 3,
      materiaIds: [2, 7],
    })

    expect(resultado).toEqual([
      { materiaId: 2, cantidad: 3 },
      { materiaId: 7, cantidad: 1 },
    ])
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['materiaId'],
        where: {
          ...condicionTurnoVigente(HOY),
          bloqueAgenda: { profesorId: 3 },
          materiaId: { in: [2, 7] },
        },
      }),
    )
  })

  it('sin filtros opcionales, cuenta todos los vigentes', async () => {
    await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY })

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: condicionTurnoVigente(HOY) }),
    )
  })
})

describe('contarVigentesPorBloque', () => {
  it('cuenta los turnos vigentes de ese bloque puntual', async () => {
    count.mockResolvedValue(2)

    const resultado = await turnosRepository.contarVigentesPorBloque(10, HOY)

    expect(resultado).toBe(2)
    expect(count).toHaveBeenCalledWith({
      where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: 10 },
    })
  })
})

describe('condicionTurnoOcupaLugar', () => {
  it('solo turnos ACTIVO (un cancelado libera su lugar) de exactamente esa fecha', () => {
    expect(condicionTurnoOcupaLugar(HOY)).toEqual({
      estado: 'ACTIVO',
      fechaInicio: MEDIANOCHE_HOY,
    })
  })
})

describe('contarVigentesPorBloques', () => {
  it('una sola consulta para todas las filas, con la condición de vigente, agrupada por fila', async () => {
    groupBy.mockResolvedValue([{ bloqueAgendaId: 11, _count: { _all: 2 } }])

    const resultado = await turnosRepository.contarVigentesPorBloques([10, 11], HOY)

    expect(resultado).toEqual([{ bloqueAgendaId: 11, cantidad: 2 }])
    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bloqueAgendaId'],
        where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: { in: [10, 11] } },
      }),
    )
  })
})

describe('contarOcupacionPorBloque', () => {
  it('una sola consulta con un OR de pares fila–fecha, y devuelve la fecha como YYYY-MM-DD', async () => {
    groupBy.mockResolvedValue([
      {
        bloqueAgendaId: 10,
        fechaInicio: new Date('2026-09-28T00:00:00.000Z'),
        _count: { _all: 3 },
      },
    ])

    const resultado = await turnosRepository.contarOcupacionPorBloque([
      { bloqueAgendaId: 10, fecha: '2026-09-28' },
      { bloqueAgendaId: 11, fecha: HOY },
    ])

    expect(resultado).toEqual([{ bloqueAgendaId: 10, fecha: '2026-09-28', cantidad: 3 }])
    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bloqueAgendaId', 'fechaInicio'],
        where: {
          OR: [
            { ...condicionTurnoOcupaLugar('2026-09-28'), bloqueAgendaId: 10 },
            { ...condicionTurnoOcupaLugar(HOY), bloqueAgendaId: 11 },
          ],
        },
      }),
    )
  })

  it('sin filas no consulta la base', async () => {
    expect(await turnosRepository.contarOcupacionPorBloque([])).toEqual([])
    expect(groupBy).not.toHaveBeenCalled()
  })
})
