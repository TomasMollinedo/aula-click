import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tableroRepository } from '../tablero.repository'

// Lo cobrado del tablero (HU-39): el repository no reimplementa la regla, pero sí tiene que usar la
// de `pagos.condiciones`, la que deja afuera los pagos anulados. Prisma mockeado: se mira con qué
// filtro se consulta, no la base.

const { prisma } = vi.hoisted(() => ({
  prisma: {
    pago: { aggregate: vi.fn(), groupBy: vi.fn() },
    formaPago: { findMany: vi.fn() },
    liquidacion: { findMany: vi.fn() },
    pagoTurno: { findMany: vi.fn() },
    asistenciaTurno: { findMany: vi.fn() },
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

describe('liquidacionesPagadas', () => {
  it('lee sólo las `PAGADA` con fecha de transferencia en el período, con su total guardado', async () => {
    prisma.liquidacion.findMany.mockResolvedValue([
      {
        profesorId: 3,
        total: { toNumber: () => 40800.5 },
        fechaTransferencia: new Date('2026-10-01T00:00:00Z'),
        profesor: { usuario: { nombre: 'Ana', apellido: 'Gómez' } },
      },
    ])

    expect(await tableroRepository.liquidacionesPagadas(PERIODO)).toEqual([
      {
        profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
        fechaTransferencia: '2026-10-01',
        total: 40800.5,
      },
    ])
    const { where } = prisma.liquidacion.findMany.mock.calls[0]?.[0]
    expect(where).toEqual({
      estado: 'PAGADA',
      fechaTransferencia: {
        gte: new Date('2026-09-28T00:00:00Z'),
        lte: new Date('2026-10-04T00:00:00Z'),
      },
    })
  })
})

describe('cobrosConReparto', () => {
  it('lee sólo los cobros vigentes del período: un pago anulado no cuenta', async () => {
    prisma.pagoTurno.findMany.mockResolvedValue([])

    expect(await tableroRepository.cobrosConReparto({ ...PERIODO, hoy: '2026-10-02' })).toEqual([])
    expect(prisma.pagoTurno.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: {
          vigente: true,
          pago: {
            fechaPago: {
              gte: new Date('2026-09-28T00:00:00Z'),
              lte: new Date('2026-10-04T00:00:00Z'),
            },
          },
        },
      }),
    )
  })
})
