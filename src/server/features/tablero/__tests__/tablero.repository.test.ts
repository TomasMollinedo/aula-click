import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tableroRepository } from '../tablero.repository'

// Lo cobrado del tablero (HU-39): el repository no reimplementa la regla, pero sí tiene que usar la
// de `pagos.condiciones`, la que deja afuera los pagos anulados. Prisma mockeado: se mira con qué
// filtro se consulta, no la base.

const { prisma } = vi.hoisted(() => ({
  prisma: {
    pago: { aggregate: vi.fn(), groupBy: vi.fn() },
    formaPago: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma }))

const PERIODO = { desde: '2026-09-28', hasta: '2026-10-04' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('totalCobrado', () => {
  it('suma sólo los pagos vigentes del período: un pago anulado no cuenta', async () => {
    prisma.pago.aggregate.mockResolvedValue({ _sum: { importeTotal: { toNumber: () => 96000 } } })

    expect(await tableroRepository.totalCobrado(PERIODO)).toBe(96000)
    expect(prisma.pago.aggregate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: expect.objectContaining({ estado: 'VIGENTE' }) }),
    )
  })
})

describe('totalCobradoPorForma', () => {
  it('separa lo cobrado por forma de pago, sólo con pagos vigentes', async () => {
    prisma.pago.groupBy.mockResolvedValue([
      { formaPagoId: 1, _sum: { importeTotal: { toNumber: () => 40000 } } },
      { formaPagoId: 2, _sum: { importeTotal: { toNumber: () => 38000 } } },
    ])
    prisma.formaPago.findMany.mockResolvedValue([
      { id: 1, tipoFormaPago: 'EFECTIVO' },
      { id: 2, tipoFormaPago: 'TRANSFERENCIA' },
    ])

    expect(await tableroRepository.totalCobradoPorForma(PERIODO)).toEqual({
      EFECTIVO: 40000,
      TRANSFERENCIA: 38000,
      DEBITO: 0,
    })
    expect(prisma.pago.groupBy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: expect.objectContaining({ estado: 'VIGENTE' }) }),
    )
  })

  it('el total y el desglose se piden con el mismo filtro: las formas suman el total cobrado', async () => {
    prisma.pago.aggregate.mockResolvedValue({ _sum: { importeTotal: null } })
    prisma.pago.groupBy.mockResolvedValue([])

    await tableroRepository.totalCobrado(PERIODO)
    await tableroRepository.totalCobradoPorForma(PERIODO)

    const dondeDelTotal = prisma.pago.aggregate.mock.calls[0]?.[0].where
    const dondeDelDesglose = prisma.pago.groupBy.mock.calls[0]?.[0].where
    expect(dondeDelDesglose).toEqual(dondeDelTotal)
  })

  it('sin pagos en el período → las tres formas en 0', async () => {
    prisma.pago.groupBy.mockResolvedValue([])

    expect(await tableroRepository.totalCobradoPorForma(PERIODO)).toEqual({
      EFECTIVO: 0,
      TRANSFERENCIA: 0,
      DEBITO: 0,
    })
  })
})
