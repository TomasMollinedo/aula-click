import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { pagosRepository } from '../pagos.repository'
import type { PlanPago } from '../pagos.reglas'
import type { EntradaPago } from '../pagos.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad del pago que el
// service no puede observar (T-51): el lock del alumno es lo primero de la transacción, si
// `verificar` lanza no se escribe nada, y la P2002 del único de `pago_turno` se traduce. Sin base:
// Prisma se reemplaza por un mock con `vi.hoisted`, y el error conocido de Prisma por una clase
// equivalente (los tests tampoco importan `@/generated`).

const {
  transaction,
  queryRaw,
  turnoFindMany,
  materiaFindMany,
  formaPagoFindFirst,
  pagoCreate,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  turnoFindMany: vi.fn(),
  materiaFindMany: vi.fn(),
  formaPagoFindFirst: vi.fn(),
  pagoCreate: vi.fn(),
  ErrorConocido: class extends Error {
    constructor(
      message: string,
      readonly opciones: { code: string; meta?: Record<string, unknown> },
    ) {
      super(message)
    }
    get code() {
      return this.opciones.code
    }
    get meta() {
      return this.opciones.meta
    }
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const tx = {
  $queryRaw: queryRaw,
  turno: { findMany: turnoFindMany },
  materia: { findMany: materiaFindMany },
  formaPago: { findFirst: formaPagoFindFirst },
  pago: { create: pagoCreate },
}

const entrada: EntradaPago = {
  alumnoId: 12,
  ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
  fechaPago: '2026-10-05',
  montoRecibido: 10000,
  observaciones: null,
}
const plan: PlanPago = {
  lineas: [{ turnoId: 41, fecha: '2026-10-12', importe: 8000.5 }],
  total: 8000.5,
  vuelto: 1999.5,
}

function p2002(constraint: unknown) {
  return new ErrorConocido('Unique constraint failed', {
    code: 'P2002',
    meta: { modelName: 'Pago', driverAdapterError: { cause: { constraint } } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  queryRaw.mockResolvedValue([])
  turnoFindMany.mockResolvedValue([])
  materiaFindMany.mockResolvedValue([])
  formaPagoFindFirst.mockResolvedValue({ id: 1 })
  pagoCreate.mockResolvedValue({ id: 31, numeroComprobante: 1024 })
})

describe('registrar', () => {
  it('bloquea el alumno antes de cualquier lectura y escribe el pago con sus PagoTurno', async () => {
    const verificar = vi.fn(() => plan)

    const res = await pagosRepository.registrar(entrada, verificar, actor)

    expect(res).toEqual({ pagoId: 31, numeroComprobante: 1024, plan })
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
    const primeraLectura = Math.min(
      turnoFindMany.mock.invocationCallOrder[0] ?? Infinity,
      formaPagoFindFirst.mock.invocationCallOrder[0] ?? Infinity,
    )
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(primeraLectura)
    expect(verificar).toHaveBeenCalledWith({ ocurrencias: [], precios: new Map() })

    expect(formaPagoFindFirst).toHaveBeenCalledWith({
      where: { nombre: 'Efectivo', estado: 'ACTIVO' },
      select: { id: true },
    })
    expect(pagoCreate).toHaveBeenCalledWith({
      data: {
        alumnoId: 12,
        formaPagoId: 1,
        importeTotal: '8000.50',
        fechaPago: new Date('2026-10-05T00:00:00.000Z'),
        montoRecibido: '10000.00',
        observaciones: null,
        createdById: 'usr_mesa',
        updatedById: 'usr_mesa',
        turnos: {
          create: [
            {
              turnoId: 41,
              fechaOcurrencia: new Date('2026-10-12T00:00:00.000Z'),
              importeAplicado: '8000.50',
            },
          ],
        },
      },
      select: { id: true, numeroComprobante: true },
    })
  })

  it('relee las ocurrencias pedidas con el tx: turnoIds y el rango de sus fechas, sin alumnoId', async () => {
    await pagosRepository.registrar(
      {
        ...entrada,
        ocurrencias: [
          { turnoId: 57, fecha: '2026-10-19' },
          { turnoId: 41, fecha: '2026-10-05' },
          { turnoId: 57, fecha: '2026-10-12' },
        ],
      },
      () => plan,
      actor,
    )

    const { where } = turnoFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(where.id).toEqual({ in: [57, 41] })
    expect(where.alumnoId).toBeUndefined()
  })

  it('si verificar lanza, no hay create', async () => {
    const error = new ConflictError('no', { code: 'TURNOS_NO_COBRABLES' })

    await expect(
      pagosRepository.registrar(
        entrada,
        () => {
          throw error
        },
        actor,
      ),
    ).rejects.toBe(error)
    expect(pagoCreate).not.toHaveBeenCalled()
  })

  it('sin la forma de pago "Efectivo" activa → 500 que pide correr el seed, sin escribir', async () => {
    formaPagoFindFirst.mockResolvedValue(null)

    const error = await pagosRepository.registrar(entrada, () => plan, actor).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(500)
    expect(error.message).toMatch(/pnpm db:seed/)
    expect(pagoCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['por nombre de índice', { index: 'pago_turno_turno_id_fecha_ocurrencia_key' }],
    ['por campos', { fields: ['turno_id', 'fecha_ocurrencia'] }],
  ])('P2002 del único de pago_turno (%s) → 409 TURNOS_NO_COBRABLES sin details', async (_, c) => {
    pagoCreate.mockRejectedValue(p2002(c))

    const error = await pagosRepository.registrar(entrada, () => plan, actor).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_COBRABLES')
    expect(error.message).toBe('Alguno de los turnos ya fue pagado')
    expect(error.details).toBeUndefined()
  })

  it.each([
    ['otro índice', { index: 'pago_numero_comprobante_key' }],
    ['forma ilegible', undefined],
  ])('otra P2002 (%s) no se traduce', async (_, c) => {
    const original = p2002(c)
    pagoCreate.mockRejectedValue(original)

    await expect(pagosRepository.registrar(entrada, () => plan, actor)).rejects.toBe(original)
  })
})
