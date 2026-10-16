import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { dateAFecha } from '@/server/shared/fechas'
import type { CierreDeLiquidacion, EscrituraDeCierre } from '../liquidaciones.condiciones'
import { liquidacionesRepository, type PagoDeLiquidacion } from '../liquidaciones.repository'

// Excepcional (arquitectura-backend.md → Tests): fija lo que el service no puede observar del pago
// de una liquidación (T-124): qué se escribe, en qué orden se resuelven las referencias y que todo
// es atómico. Sin base: Prisma se reemplaza por un cliente en memoria cuya transacción sólo confirma
// si el callback termina bien, y el cálculo del cierre (`cierreDeLiquidacion`, T-121, ya testeado)
// por un mock: acá sólo importan las escrituras.

const { cierreDeLiquidacion, transaction, ErrorConocido } = vi.hoisted(() => ({
  cierreDeLiquidacion: vi.fn(),
  transaction: vi.fn(),
  ErrorConocido: class extends Error {
    constructor(
      message: string,
      readonly code: string,
    ) {
      super(message)
    }
  },
}))
vi.mock('../liquidaciones.condiciones', async (original) => ({
  ...(await original<typeof import('../liquidaciones.condiciones')>()),
  cierreDeLiquidacion,
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))

const gerente: Actor = { userId: 'usr_gerente', role: 'GERENTE' }
const GOMEZ = { id: 4, nombre: 'Ana', apellido: 'Gómez' }

type FilaLiquidacion = Record<string, unknown> & { id: number; profesorId: number; mes: Date }
type Base = {
  liquidaciones: FilaLiquidacion[]
  ajustes: Record<string, unknown>[]
  adjuntos: { id: number; createdById: string; liquidacionId: number | null }[]
}

let base: Base
/** Si se setea, `liquidacion.create` lanza esto (una P2002 simulada). */
let errorAlCrear: unknown

function clienteDe(b: Base) {
  return {
    liquidacion: {
      findUnique: vi.fn(
        async ({ where }: { where: { profesorId_mes: { profesorId: number; mes: Date } } }) => {
          const { profesorId, mes } = where.profesorId_mes
          return (
            b.liquidaciones.find(
              (l) => l.profesorId === profesorId && l.mes.getTime() === mes.getTime(),
            ) ?? null
          )
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (errorAlCrear) throw errorAlCrear
        const id = 100 + b.liquidaciones.length
        b.liquidaciones.push({ ...data, id } as FilaLiquidacion)
        return { id }
      }),
    },
    ajusteLiquidacion: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        b.ajustes.push(...data)
        return { count: data.length }
      }),
    },
    comprobanteAdjunto: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: number; createdById: string }
          data: { liquidacionId: number }
        }) => {
          const adjunto = b.adjuntos.find(
            (a) =>
              a.id === where.id && a.createdById === where.createdById && a.liquidacionId === null,
          )
          if (!adjunto) return { count: 0 }
          adjunto.liquidacionId = data.liquidacionId
          return { count: 1 }
        },
      ),
    },
  }
}

const copia = (b: Base): Base => structuredClone(b)

beforeEach(() => {
  vi.clearAllMocks()
  errorAlCrear = undefined
  base = {
    liquidaciones: [],
    ajustes: [],
    adjuntos: [{ id: 44, createdById: 'usr_gerente', liquidacionId: null }],
  }
  // Todo o nada: se trabaja sobre una copia y sólo se confirma si el callback termina bien.
  transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const borrador = copia(base)
    const resultado = await fn(clienteDe(borrador))
    base = borrador
    return resultado
  })
})

function escritura(
  mes: string,
  estado: EscrituraDeCierre['estado'],
  cambios: Partial<EscrituraDeCierre> = {},
): EscrituraDeCierre {
  return {
    mes,
    estado,
    descontadaEnMes: null,
    totalCobrado: 8000,
    parteCentro: 1200,
    parteProfesor: 6800,
    totalAjustes: 0,
    total: 6800,
    turnos: [
      {
        pagoTurnoId: Number(mes.slice(5)) * 10,
        fechaDevengo: `${mes}-08`,
        importe: 8000,
        porcentaje: 15,
        parteProfesor: 6800,
      },
    ],
    ajustes: [],
    ...cambios,
  }
}

function cierre(escrituras: EscrituraDeCierre[]): CierreDeLiquidacion {
  const pagada = escrituras.at(-1)!
  return { liquidacion: { total: pagada.total }, escrituras } as CierreDeLiquidacion
}

const pago: PagoDeLiquidacion = {
  profesor: GOMEZ,
  mes: '2026-09',
  hoy: '2026-10-15',
  fechaTransferencia: '2026-10-05',
  numeroOperacion: '0004829137',
  observaciones: 'Transferencia de septiembre',
  comprobanteAdjuntoId: 44,
  totalConfirmado: 6800,
}

const filas = () =>
  base.liquidaciones.map((l): Record<string, unknown> => ({ ...l, mes: dateAFecha(l.mes) }))

async function errorDe(promesa: Promise<unknown>) {
  return promesa.then(
    () => expect.fail('debía lanzar'),
    (error: unknown) => error,
  )
}

describe('pagar', () => {
  it('una PENDIENTE_DE_PAGO: la PAGADA con sus turnos, la transferencia y el creador, y el adjunto vinculado', async () => {
    cierreDeLiquidacion.mockResolvedValue(cierre([escritura('2026-09', 'PAGADA')]))

    const resultado = await liquidacionesRepository.pagar(pago, gerente)

    expect(cierreDeLiquidacion).toHaveBeenCalledWith(expect.anything(), {
      profesorId: 4,
      mes: '2026-09',
      hoy: '2026-10-15',
    })
    expect(resultado).toEqual({ liquidacionId: 100, total: 6800 })
    expect(filas()).toEqual([
      {
        id: 100,
        profesorId: 4,
        mes: '2026-09-01',
        estado: 'PAGADA',
        // Los importes del cierre, tal cual: la cerrada no se recalcula al leerla (T-156).
        totalCobrado: '8000.00',
        parteCentro: '1200.00',
        parteProfesor: '6800.00',
        totalAjustes: '0.00',
        total: '6800.00',
        fechaTransferencia: new Date('2026-10-05T00:00:00.000Z'),
        numeroOperacion: '0004829137',
        observaciones: 'Transferencia de septiembre',
        descontadaEnId: null,
        createdById: 'usr_gerente',
        turnos: {
          createMany: {
            data: [
              {
                pagoTurnoId: 90,
                fechaDevengo: new Date('2026-09-08T00:00:00.000Z'),
                importe: '8000.00',
                porcentajeCentro: '15.00',
                parteProfesor: '6800.00',
              },
            ],
          },
        },
      },
    ])
    expect(base.ajustes).toEqual([])
    expect(base.adjuntos).toEqual([{ id: 44, createdById: 'usr_gerente', liquidacionId: 100 }])
  })

  it('un mes que absorbe una cadena de dos saldos negativos: DESCONTADA con su descontadaEnId y SALDO_ANTERIOR a su origen', async () => {
    cierreDeLiquidacion.mockResolvedValue(
      cierre([
        escritura('2026-07', 'DESCONTADA', {
          descontadaEnMes: '2026-08',
          totalAjustes: -10000,
          total: -3200,
          ajustes: [{ tipo: 'ANULACION', liquidacionTurnoId: 5, importe: -10000 }],
        }),
        escritura('2026-08', 'DESCONTADA', {
          descontadaEnMes: '2026-09',
          totalAjustes: -10000,
          total: -3200,
          ajustes: [{ tipo: 'SALDO_ANTERIOR', mesOrigen: '2026-07', importe: -3200 }],
        }),
        escritura('2026-09', 'PAGADA', {
          totalAjustes: -3200,
          total: 3600,
          ajustes: [{ tipo: 'SALDO_ANTERIOR', mesOrigen: '2026-08', importe: -3200 }],
        }),
      ]),
    )

    const resultado = await liquidacionesRepository.pagar(
      { ...pago, totalConfirmado: 3600 },
      gerente,
    )

    // La PAGADA se crea primero, así cada DESCONTADA ya tiene a quién apuntar.
    expect(resultado).toEqual({ liquidacionId: 100, total: 3600 })
    expect(
      filas().map((l) => [
        l.id,
        l.mes,
        l.estado,
        l.descontadaEnId,
        l.fechaTransferencia,
        l.numeroOperacion,
        l.observaciones,
        l.createdById,
      ]),
    ).toEqual([
      [
        100,
        '2026-09-01',
        'PAGADA',
        null,
        new Date('2026-10-05T00:00:00.000Z'),
        '0004829137',
        'Transferencia de septiembre',
        'usr_gerente',
      ],
      [101, '2026-08-01', 'DESCONTADA', 100, null, null, null, 'usr_gerente'],
      [102, '2026-07-01', 'DESCONTADA', 101, null, null, null, 'usr_gerente'],
    ])
    expect(base.ajustes).toEqual([
      { liquidacionId: 102, tipo: 'ANULACION', importe: '-10000.00', liquidacionTurnoId: 5 },
      { liquidacionId: 101, tipo: 'SALDO_ANTERIOR', importe: '-3200.00', liquidacionOrigenId: 102 },
      { liquidacionId: 100, tipo: 'SALDO_ANTERIOR', importe: '-3200.00', liquidacionOrigenId: 101 },
    ])
  })

  it('sin comprobante: no vincula nada', async () => {
    cierreDeLiquidacion.mockResolvedValue(cierre([escritura('2026-09', 'PAGADA')]))

    await liquidacionesRepository.pagar({ ...pago, comprobanteAdjuntoId: null }, gerente)

    expect(base.liquidaciones).toHaveLength(1)
    expect(base.adjuntos[0]!.liquidacionId).toBeNull()
  })

  it('ya pagada → 409 LIQUIDACION_PAGADA', async () => {
    base.liquidaciones.push({
      id: 7,
      profesorId: 4,
      mes: new Date('2026-09-01T00:00:00.000Z'),
      estado: 'PAGADA',
    })
    cierreDeLiquidacion.mockResolvedValue(null)

    const error = await errorDe(liquidacionesRepository.pagar(pago, gerente))

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as AppError).code).toBe('LIQUIDACION_PAGADA')
    expect((error as AppError).message).toBe(
      'La liquidación de septiembre de 2026 de Gómez, Ana ya está pagada',
    )
    expect(base.liquidaciones).toHaveLength(1)
  })

  it.each([
    ['SALDO_A_DESCONTAR o sin movimientos', null],
    ['DESCONTADA', 'DESCONTADA'],
  ])('%s → 409 CONFLICTO "No hay importe a pagar"', async (_caso, estado) => {
    if (estado) {
      base.liquidaciones.push({
        id: 7,
        profesorId: 4,
        mes: new Date('2026-09-01T00:00:00.000Z'),
        estado,
      })
    }
    cierreDeLiquidacion.mockResolvedValue(null)

    const error = await errorDe(liquidacionesRepository.pagar(pago, gerente))

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as AppError).code).toBe('CONFLICTO')
    expect((error as AppError).message).toBe('No hay importe a pagar')
  })

  it('totalConfirmado distinto → 409 LIQUIDACION_MODIFICADA sin ninguna escritura', async () => {
    cierreDeLiquidacion.mockResolvedValue(cierre([escritura('2026-09', 'PAGADA')]))

    const error = await errorDe(
      liquidacionesRepository.pagar({ ...pago, totalConfirmado: 6800.01 }, gerente),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as AppError).code).toBe('LIQUIDACION_MODIFICADA')
    expect((error as AppError).message).toBe(
      'La liquidación cambió desde que la abriste. Revisala antes de pagar',
    )
    expect(base.liquidaciones).toEqual([])
    expect(base.adjuntos[0]!.liquidacionId).toBeNull()
  })

  it('P2002 de un único (otro pago ganó) → 409 LIQUIDACION_MODIFICADA', async () => {
    cierreDeLiquidacion.mockResolvedValue(cierre([escritura('2026-09', 'PAGADA')]))
    errorAlCrear = new ErrorConocido('Unique constraint failed', 'P2002')

    const error = await errorDe(liquidacionesRepository.pagar(pago, gerente))

    expect(error).toBeInstanceOf(ConflictError)
    expect((error as AppError).code).toBe('LIQUIDACION_MODIFICADA')
    expect(base.liquidaciones).toEqual([])
  })

  it('otro error de Prisma no se traduce', async () => {
    cierreDeLiquidacion.mockResolvedValue(cierre([escritura('2026-09', 'PAGADA')]))
    errorAlCrear = new ErrorConocido('Foreign key', 'P2003')

    await expect(liquidacionesRepository.pagar(pago, gerente)).rejects.toBe(errorAlCrear)
  })

  it('adjunto inválido → 400 ADJUNTO_INVALIDO y nada escrito', async () => {
    cierreDeLiquidacion.mockResolvedValue(
      cierre([
        escritura('2026-08', 'DESCONTADA', { descontadaEnMes: '2026-09', total: -100 }),
        escritura('2026-09', 'PAGADA', {
          ajustes: [{ tipo: 'SALDO_ANTERIOR', mesOrigen: '2026-08', importe: -100 }],
        }),
      ]),
    )
    base.adjuntos = [{ id: 44, createdById: 'usr_otro', liquidacionId: null }]

    const error = await errorDe(liquidacionesRepository.pagar(pago, gerente))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as AppError).code).toBe('ADJUNTO_INVALIDO')
    expect(base.liquidaciones).toEqual([])
    expect(base.ajustes).toEqual([])
  })
})
