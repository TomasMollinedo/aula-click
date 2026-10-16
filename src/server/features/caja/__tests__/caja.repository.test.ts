import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cajaRepository } from '../caja.repository'

// Lecturas de la caja (T-127), con Prisma mockeado: se mira con qué filtro se consulta y cómo se
// arman los movimientos, no la base.

const { prisma } = vi.hoisted(() => ({
  prisma: {
    pago: { findMany: vi.fn() },
    anulacionPago: { findMany: vi.fn() },
    liquidacion: { findMany: vi.fn() },
    formaPago: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma }))

const decimal = (valor: number) => ({ toNumber: () => valor })

function filaPago(cambios: Record<string, unknown> = {}) {
  return {
    id: 31,
    numeroComprobante: 1024,
    importeTotal: decimal(16000),
    estado: 'VIGENTE',
    createdAt: new Date('2026-10-15T13:00:00.000Z'),
    alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
    formaPago: { tipoFormaPago: 'EFECTIVO', nombre: 'Efectivo' },
    turnos: [
      { importeAplicado: decimal(8000), porcentajeCentro: decimal(15) },
      { importeAplicado: decimal(8000), porcentajeCentro: decimal(20) },
    ],
    ...cambios,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cobrosDelDia', () => {
  it('pide los pagos de esa fecha de pago, vigentes y anulados, por hora de registro', async () => {
    prisma.pago.findMany.mockResolvedValue([])

    await cajaRepository.cobrosDelDia('2026-10-15')

    const consulta = prisma.pago.findMany.mock.calls[0]?.[0]
    expect(consulta.where).toEqual({ fechaPago: new Date('2026-10-15T00:00:00.000Z') })
    expect(consulta.where).not.toHaveProperty('estado')
    expect(consulta.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
  })

  it('arma el cobro con importes en pesos, los turnos con su porcentaje y el estado', async () => {
    prisma.pago.findMany.mockResolvedValue([filaPago({ estado: 'ANULADO' })])

    expect(await cajaRepository.cobrosDelDia('2026-10-15')).toStrictEqual([
      {
        pagoId: 31,
        numeroComprobante: 1024,
        registradoEl: '2026-10-15T13:00:00.000Z',
        alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
        formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
        importe: 16000,
        turnos: [
          { importe: 8000, porcentaje: 15 },
          { importe: 8000, porcentaje: 20 },
        ],
        estado: 'ANULADO',
      },
    ])
  })

  it('una forma de pago sin código → 500 (falta el seed)', async () => {
    prisma.pago.findMany.mockResolvedValue([
      filaPago({ formaPago: { tipoFormaPago: null, nombre: 'Cheque' } }),
    ])

    await expect(cajaRepository.cobrosDelDia('2026-10-15')).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})

describe('anulacionesDelDia', () => {
  const anulacion = (createdAt: string) => ({
    motivo: 'ERROR_CARGA',
    detalle: 'Se cargó dos veces',
    createdAt: new Date(createdAt),
    pago: filaPago({ estado: 'ANULADO', createdAt: new Date('2026-10-14T13:00:00.000Z') }),
  })

  it('arma la anulación con el pago que anula y la hora de la anulación, no la del pago', async () => {
    prisma.anulacionPago.findMany.mockResolvedValue([anulacion('2026-10-15T14:20:00.000Z')])

    expect(await cajaRepository.anulacionesDelDia('2026-10-15')).toStrictEqual([
      {
        pagoId: 31,
        numeroComprobante: 1024,
        registradoEl: '2026-10-15T14:20:00.000Z',
        alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
        formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
        importe: 16000,
        turnos: [
          { importe: 8000, porcentaje: 15 },
          { importe: 8000, porcentaje: 20 },
        ],
        motivo: 'ERROR_CARGA',
        detalle: 'Se cargó dos veces',
      },
    ])
  })

  it('el día es el de Salta (UTC−3): las 02:00 UTC del 16 son del 15 y las 03:00 UTC, del 16', async () => {
    prisma.anulacionPago.findMany.mockResolvedValue([
      anulacion('2026-10-15T02:59:00.000Z'), // 14/10 23:59 en Salta
      anulacion('2026-10-15T03:00:00.000Z'), // 15/10 00:00
      anulacion('2026-10-16T02:59:00.000Z'), // 15/10 23:59
      anulacion('2026-10-16T03:00:00.000Z'), // 16/10 00:00
    ])

    const del15 = await cajaRepository.anulacionesDelDia('2026-10-15')

    expect(del15.map((a) => a.registradoEl)).toEqual([
      '2026-10-15T03:00:00.000Z',
      '2026-10-16T02:59:00.000Z',
    ])
  })

  it('pide un margen de un día a cada lado y deja que la fecha de Salta decida', async () => {
    prisma.anulacionPago.findMany.mockResolvedValue([])

    await cajaRepository.anulacionesDelDia('2026-10-15')

    const consulta = prisma.anulacionPago.findMany.mock.calls[0]?.[0]
    expect(consulta.where.createdAt).toEqual({
      gte: new Date('2026-10-14T00:00:00.000Z'),
      lt: new Date('2026-10-17T00:00:00.000Z'),
    })
    expect(consulta.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
  })
})

describe('pagosAProfesoresDelDia', () => {
  const liquidacion = {
    profesorId: 4,
    mes: new Date('2026-09-01T00:00:00.000Z'),
    numeroOperacion: '0048213',
    total: decimal(6800),
    createdAt: new Date('2026-10-15T15:05:00.000Z'),
    profesor: { usuario: { nombre: 'Ana', apellido: 'Gómez' } },
  }

  it('pide sólo las PAGADA con esa fecha de transferencia', async () => {
    prisma.liquidacion.findMany.mockResolvedValue([])

    await cajaRepository.pagosAProfesoresDelDia('2026-10-15')

    const consulta = prisma.liquidacion.findMany.mock.calls[0]?.[0]
    expect(consulta.where).toEqual({
      estado: 'PAGADA',
      fechaTransferencia: new Date('2026-10-15T00:00:00.000Z'),
    })
  })

  it('arma el pago con el mes en YYYY-MM, el importe guardado y la forma TRANSFERENCIA', async () => {
    prisma.liquidacion.findMany.mockResolvedValue([liquidacion])
    prisma.formaPago.findUnique.mockResolvedValue({ nombre: 'Transferencia' })

    expect(await cajaRepository.pagosAProfesoresDelDia('2026-10-15')).toStrictEqual([
      {
        profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
        mes: '2026-09',
        numeroOperacion: '0048213',
        formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
        importe: 6800,
        registradoEl: '2026-10-15T15:05:00.000Z',
      },
    ])
    expect(prisma.formaPago.findUnique).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: { tipoFormaPago: 'TRANSFERENCIA' } }),
    )
  })

  it('sin pagos no busca la forma de pago', async () => {
    prisma.liquidacion.findMany.mockResolvedValue([])

    expect(await cajaRepository.pagosAProfesoresDelDia('2026-10-15')).toEqual([])
    expect(prisma.formaPago.findUnique).not.toHaveBeenCalled()
  })

  it('sin la forma TRANSFERENCIA cargada → 500 (falta el seed)', async () => {
    prisma.liquidacion.findMany.mockResolvedValue([liquidacion])
    prisma.formaPago.findUnique.mockResolvedValue(null)

    await expect(cajaRepository.pagosAProfesoresDelDia('2026-10-15')).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
