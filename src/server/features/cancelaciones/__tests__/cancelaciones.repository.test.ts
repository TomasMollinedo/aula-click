import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { cancelacionesRepository } from '../cancelaciones.repository'
import type { PlanCancelacion } from '../cancelaciones.reglas'
import type { EntradaCancelacion } from '../cancelaciones.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad de la cancelación
// que el service no puede observar (T-45): el lock del alumno es lo primero de la transacción, si
// `verificar` lanza no se escribe nada, y la P2002 del único se traduce. Sin base: Prisma se
// reemplaza por un mock con `vi.hoisted`, y el error conocido de Prisma por una clase equivalente.

const { transaction, queryRaw, turnoFindMany, cancelacionCreateMany, ErrorConocido } = vi.hoisted(
  () => ({
    transaction: vi.fn(),
    queryRaw: vi.fn(),
    turnoFindMany: vi.fn(),
    cancelacionCreateMany: vi.fn(),
    ErrorConocido: class extends Error {
      readonly code = 'P2002'
    },
  }),
)
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const tx = {
  $queryRaw: queryRaw,
  turno: { findMany: turnoFindMany },
  cancelacionTurno: { createMany: cancelacionCreateMany },
}

const entrada: EntradaCancelacion = {
  alumnoId: 12,
  ocurrencias: [
    { turnoId: 57, fecha: '2026-10-19' },
    { turnoId: 41, fecha: '2026-10-12' },
  ],
  motivo: 'OTRO',
  detalle: 'Feriado',
}
const plan: PlanCancelacion = { alumnoId: 12, lineas: entrada.ocurrencias }

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  queryRaw.mockResolvedValue([])
  turnoFindMany.mockResolvedValue([])
  cancelacionCreateMany.mockResolvedValue({ count: 2 })
})

describe('cancelar', () => {
  it('bloquea el alumno antes de cualquier lectura y escribe una CancelacionTurno por línea', async () => {
    const verificar = vi.fn(() => plan)

    const res = await cancelacionesRepository.cancelar(entrada, verificar, actor)

    expect(res).toBe(plan)
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      turnoFindMany.mock.invocationCallOrder[0] ?? Infinity,
    )
    expect(verificar).toHaveBeenCalledWith([])

    const { where } = turnoFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(where.id).toEqual({ in: [57, 41] })
    expect(where.alumnoId).toBeUndefined()

    expect(cancelacionCreateMany).toHaveBeenCalledWith({
      data: [
        {
          turnoId: 57,
          fechaOcurrencia: new Date('2026-10-19T00:00:00.000Z'),
          motivo: 'OTRO',
          detalle: 'Feriado',
          createdById: 'usr_mesa',
        },
        {
          turnoId: 41,
          fechaOcurrencia: new Date('2026-10-12T00:00:00.000Z'),
          motivo: 'OTRO',
          detalle: 'Feriado',
          createdById: 'usr_mesa',
        },
      ],
    })
  })

  it('si verificar lanza, no se escribe nada', async () => {
    const error = new ConflictError('no', { code: 'TURNOS_NO_CANCELABLES' })

    await expect(
      cancelacionesRepository.cancelar(
        entrada,
        () => {
          throw error
        },
        actor,
      ),
    ).rejects.toBe(error)
    expect(cancelacionCreateMany).not.toHaveBeenCalled()
  })

  it('P2002 del único → 409 TURNOS_NO_CANCELABLES sin details', async () => {
    cancelacionCreateMany.mockRejectedValue(new ErrorConocido('Unique constraint failed'))

    const error = await cancelacionesRepository.cancelar(entrada, () => plan, actor).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_CANCELABLES')
    expect(error.message).toBe('Alguno de los turnos ya fue cancelado')
    expect(error.details).toBeUndefined()
  })

  it('cualquier otro error se propaga tal cual', async () => {
    const original = new Error('boom')
    cancelacionCreateMany.mockRejectedValue(original)

    await expect(cancelacionesRepository.cancelar(entrada, () => plan, actor)).rejects.toBe(
      original,
    )
  })
})
