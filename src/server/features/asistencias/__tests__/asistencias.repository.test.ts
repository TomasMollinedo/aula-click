import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/server/shared/actor'
import { asistenciasRepository } from '../asistencias.repository'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de la escritura que el service no
// puede observar: los locks de los alumnos van primero y ordenados, si `verificar` lanza no se
// escribe nada, y el `upsert` sobre el único deja la auditoría (registrar: creador y modificador;
// corregir: sólo el modificador). Sin base: Prisma se reemplaza por un mock.

const { transaction, queryRaw, turnoFindMany, upsert } = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  turnoFindMany: vi.fn(),
  upsert: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))

const reloj = () => new Date('2026-10-14T15:00:00Z')
const actor: Actor = { userId: 'usr_prof', role: 'PROFESOR' }
const tx = {
  $queryRaw: queryRaw,
  turno: { findMany: turnoFindMany },
  asistenciaTurno: { upsert },
}
const filtro = { profesorId: 5, desde: '2026-10-14', hasta: '2026-10-14', turnoIds: [41] }
const escritura = {
  turnoId: 41,
  fecha: '2026-10-14',
  estado: 'PRESENTE' as const,
  trabajado: 'Despeje',
  indicaciones: null,
  observacion: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation(async (fn: (cliente: typeof tx) => unknown) => fn(tx))
  turnoFindMany.mockResolvedValue([])
})

describe('registrar', () => {
  it('bloquea cada alumno una vez, ordenados, antes de leer', async () => {
    await asistenciasRepository.registrar(
      { alumnoIds: [20, 12, 20], filtro },
      () => [],
      actor,
      reloj,
    )

    const ids = queryRaw.mock.calls.map(([, alumnoId]) => alumnoId)
    expect(ids).toEqual([12, 20])
    expect(queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      turnoFindMany.mock.invocationCallOrder[0] ?? Infinity,
    )
  })

  it('upsert sobre el único: crea con creador y modificador, corrige sólo el modificador', async () => {
    await asistenciasRepository.registrar({ alumnoIds: [12], filtro }, () => [escritura], actor)

    const datos = {
      estado: 'PRESENTE',
      trabajado: 'Despeje',
      indicaciones: null,
      observacion: null,
    }
    expect(upsert).toHaveBeenCalledWith({
      where: {
        turnoId_fechaOcurrencia: {
          turnoId: 41,
          fechaOcurrencia: new Date('2026-10-14T00:00:00.000Z'),
        },
      },
      create: {
        turnoId: 41,
        fechaOcurrencia: new Date('2026-10-14T00:00:00.000Z'),
        ...datos,
        createdById: 'usr_prof',
        updatedById: 'usr_prof',
      },
      update: { ...datos, updatedById: 'usr_prof' },
    })
  })

  it('si verificar lanza, no escribe nada', async () => {
    const error = new Error('fuera de plazo')

    await expect(
      asistenciasRepository.registrar(
        { alumnoIds: [12], filtro },
        () => {
          throw error
        },
        actor,
      ),
    ).rejects.toBe(error)
    expect(upsert).not.toHaveBeenCalled()
  })
})
