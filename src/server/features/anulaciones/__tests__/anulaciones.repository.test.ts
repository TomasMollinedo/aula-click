import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { anulacionesRepository } from '../anulaciones.repository'
import { exigirAnulable } from '../anulaciones.reglas'
import type { EntradaAnulacion } from '../anulaciones.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad de la anulación que
// el service no puede observar (T-104): el lock del alumno es lo primero de la transacción, si
// `verificar` lanza no se escribe nada, las tres escrituras salen juntas y la P2002 se traduce. Sin
// base: Prisma se reemplaza por un mock con `vi.hoisted`, y el error conocido de Prisma por una
// clase equivalente.

const {
  transaction,
  queryRaw,
  pagoFindUnique,
  pagoUpdate,
  anulacionCreate,
  pagoTurnoUpdateMany,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  pagoFindUnique: vi.fn(),
  pagoUpdate: vi.fn(),
  anulacionCreate: vi.fn(),
  pagoTurnoUpdateMany: vi.fn(),
  ErrorConocido: class extends Error {
    readonly code = 'P2002'
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const tx = {
  $queryRaw: queryRaw,
  pago: { findUnique: pagoFindUnique, update: pagoUpdate },
  anulacionPago: { create: anulacionCreate },
  pagoTurno: { updateMany: pagoTurnoUpdateMany },
}

const entrada: EntradaAnulacion = {
  pagoId: 31,
  alumnoId: 12,
  motivo: 'OTRO',
  detalle: 'Alumno equivocado',
}
const fila = {
  id: 31,
  numeroComprobante: 123,
  estado: 'VIGENTE',
  importeTotal: { toNumber: () => 16000 },
  transferenciaOperacion: null,
  transferenciaBanco: null,
  alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
  turnos: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  queryRaw.mockResolvedValue([])
  pagoFindUnique.mockResolvedValue(fila)
  pagoUpdate.mockResolvedValue({})
  anulacionCreate.mockResolvedValue({})
  pagoTurnoUpdateMany.mockResolvedValue({ count: 2 })
})

describe('anular', () => {
  it('bloquea el alumno antes de cualquier lectura y escribe pago, anulación y PagoTurno', async () => {
    const verificar = vi.fn((pago) => pago)

    const cantidad = await anulacionesRepository.anular(entrada, verificar, actor)

    expect(cantidad).toBe(2)
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      pagoFindUnique.mock.invocationCallOrder[0] ?? Infinity,
    )
    expect(verificar).toHaveBeenCalledWith(expect.objectContaining({ id: 31, estado: 'VIGENTE' }))

    expect(pagoUpdate).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { estado: 'ANULADO', updatedById: 'usr_mesa' },
    })
    expect(anulacionCreate).toHaveBeenCalledWith({
      data: { pagoId: 31, motivo: 'OTRO', detalle: 'Alumno equivocado', createdById: 'usr_mesa' },
    })
    // Todas las filas del pago, no sólo algunas: vigente = null, nunca false.
    expect(pagoTurnoUpdateMany).toHaveBeenCalledWith({
      where: { pagoId: 31 },
      data: { vigente: null },
    })
  })

  it('si verificar lanza, no se escribe nada', async () => {
    const error = new ConflictError('no', { code: 'PAGO_ANULADO' })

    await expect(
      anulacionesRepository.anular(
        entrada,
        () => {
          throw error
        },
        actor,
      ),
    ).rejects.toBe(error)
    expect(pagoUpdate).not.toHaveBeenCalled()
    expect(anulacionCreate).not.toHaveBeenCalled()
    expect(pagoTurnoUpdateMany).not.toHaveBeenCalled()
  })

  it('P2002 del único → 409 PAGO_ANULADO', async () => {
    anulacionCreate.mockRejectedValue(new ErrorConocido('Unique constraint failed'))

    const error = await anulacionesRepository.anular(entrada, exigirAnulable, actor).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('PAGO_ANULADO')
    expect(error.message).toBe('Un pago anulado no se puede volver a activar')
  })

  it('cualquier otro error se propaga tal cual', async () => {
    const original = new Error('boom')
    anulacionCreate.mockRejectedValue(original)

    await expect(anulacionesRepository.anular(entrada, exigirAnulable, actor)).rejects.toBe(
      original,
    )
  })
})
