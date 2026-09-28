import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/server/shared/actor'
import { profesoresRepository } from '../profesores.repository'

// Excepcional (arquitectura-backend.md → Tests): fija que la verificación de la capacidad bajo
// lock (T-15, T-39) no se puede saltear. Sin base ni variables de entorno: Prisma, auth y storage
// se reemplazan por mocks.

const { transaction, queryRaw, update, bloqueFindMany, findUnique } = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  update: vi.fn(),
  bloqueFindMany: vi.fn(),
  findUnique: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    profesor: { findUnique },
  },
}))
vi.mock('@/lib/auth', () => ({ hashPassword: vi.fn() }))
vi.mock('@/lib/storage', () => ({ putObject: vi.fn(), deleteObject: vi.fn() }))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const tx = {
  $queryRaw: queryRaw,
  profesor: { update },
  bloqueAgenda: { findMany: bloqueFindMany },
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  queryRaw.mockResolvedValue([])
  update.mockResolvedValue({ id: 3 })
  bloqueFindMany.mockResolvedValue([])
  findUnique.mockResolvedValue(null)
})

describe('actualizar: capacidad', () => {
  it('cambiar la capacidad sin `ocupacion` es un error de programación: no escribe nada', async () => {
    await expect(profesoresRepository.actualizar(3, { capacidad: 2 }, actor)).rejects.toThrow(
      /requiere `ocupacion`/,
    )
    expect(transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('con `ocupacion`, bloquea el profesor y verifica antes del UPDATE; si verificar lanza, no escribe', async () => {
    const error = new Error('capacidad insuficiente')
    const verificar = vi.fn(() => {
      throw error
    })

    await expect(
      profesoresRepository.actualizar(3, { capacidad: 2 }, actor, {
        fechaHoy: '2026-09-22',
        verificar,
      }),
    ).rejects.toBe(error)

    const [sql] = queryRaw.mock.calls[0] as [{ strings: string[] } | TemplateStringsArray]
    expect(Array.from('strings' in sql ? sql.strings : sql).join('?')).toMatch(
      /FROM profesor WHERE id = \? FOR UPDATE/,
    )
    expect(verificar).toHaveBeenCalledWith([])
    expect(update).not.toHaveBeenCalled()
  })

  it('sin capacidad en los cambios no bloquea ni verifica', async () => {
    // Después del UPDATE relee el detalle; el mock no lo tiene, así que termina en 404.
    await expect(
      profesoresRepository.actualizar(3, { telefono: '3874000000' }, actor),
    ).rejects.toThrow('Profesor no encontrado')

    expect(queryRaw).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})
