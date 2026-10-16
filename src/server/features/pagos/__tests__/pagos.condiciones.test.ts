import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/server/errors'
import {
  leerPagoDeOcurrencia,
  leerPagoParaAnular,
  pagosConMismaTransferencia,
  pagosDelFiltro,
  totalCobradoEntre,
  totalCobradoPorForma,
} from '../pagos.condiciones'

// `leerPagoDeOcurrencia`: lo que el detalle de una ocurrencia pagada muestra de su pago. Sin base:
// el cliente es un falso con el `findUnique` de `pago`.

type Cliente = Parameters<typeof leerPagoDeOcurrencia>[0]

function cliente(fila: unknown) {
  const findUnique = vi.fn(async () => fila)
  return { client: { pago: { findUnique } } as unknown as Cliente, findUnique }
}

describe('leerPagoDeOcurrencia', () => {
  it('arma los datos del pago: fecha `YYYY-MM-DD`, instante ISO, forma de pago y quién lo registró', async () => {
    const { client, findUnique } = cliente({
      numeroComprobante: 1024,
      fechaPago: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T14:30:00.000Z'),
      formaPago: { id: 1, nombre: 'Efectivo' },
      createdBy: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
    })

    await expect(leerPagoDeOcurrencia(client, 31)).resolves.toEqual({
      numeroComprobante: 1024,
      fechaPago: '2026-10-01',
      formaPago: { id: 1, nombre: 'Efectivo' },
      registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
      registradoEl: '2026-10-01T14:30:00.000Z',
    })
    expect(findUnique).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: { id: 31 } }),
    )
  })

  it('no lee importes: el de la ocurrencia es su `importeAplicado`, que ya trae el motor', async () => {
    const { client, findUnique } = cliente(null)
    await leerPagoDeOcurrencia(client, 31)

    const select = (findUnique.mock.calls[0] as unknown as [{ select: object }])[0].select
    expect(Object.keys(select).sort()).toEqual([
      'createdAt',
      'createdBy',
      'fechaPago',
      'formaPago',
      'numeroComprobante',
    ])
  })

  it('el pago no existe → `null`', async () => {
    const { client } = cliente(null)
    await expect(leerPagoDeOcurrencia(client, 99)).resolves.toBeNull()
  })
})

// `totalCobradoEntre` (T-61): el total cobrado de un período para el tablero. El cliente es un
// falso con el `aggregate` de `pago`; el importe sumado, un falso de `Prisma.Decimal`.

function clienteConSuma(importeTotal: { toNumber(): number } | null) {
  const aggregate = vi.fn(async () => ({ _sum: { importeTotal } }))
  return { client: { pago: { aggregate } } as unknown as Cliente, aggregate }
}

describe('totalCobradoEntre', () => {
  const PERIODO = { desde: '2026-09-28', hasta: '2026-10-04' }

  it('suma en la base y devuelve un `number`, no un `Decimal`', async () => {
    const { client, aggregate } = clienteConSuma({ toNumber: () => 30001.5 })

    const total = await totalCobradoEntre(client, PERIODO)

    expect(total).toBe(30001.5)
    expect(typeof total).toBe('number')
    expect(aggregate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ _sum: { importeTotal: true } }),
    )
  })

  it('filtra los pagos `VIGENTE` por `fechaPago`, con los dos extremos incluidos', async () => {
    const { client, aggregate } = clienteConSuma(null)
    await totalCobradoEntre(client, PERIODO)

    const { where } = (aggregate.mock.calls[0] as unknown as [{ where: object }])[0]
    expect(where).toEqual({
      estado: 'VIGENTE',
      fechaPago: {
        gte: new Date('2026-09-28T00:00:00.000Z'),
        lte: new Date('2026-10-04T00:00:00.000Z'),
      },
    })
  })

  it('sin pagos en el período (`_sum.importeTotal` nulo) → 0', async () => {
    const { client } = clienteConSuma(null)
    await expect(totalCobradoEntre(client, PERIODO)).resolves.toBe(0)
  })
})

describe('totalCobradoPorForma', () => {
  const PERIODO = { desde: '2026-09-28', hasta: '2026-10-04' }
  const decimal = (n: number) => ({ toNumber: () => n })

  function clienteConGrupos(
    grupos: { formaPagoId: number; importe: number | null }[],
    formas: { id: number; tipoFormaPago: string | null }[],
  ) {
    const groupBy = vi.fn(async () =>
      grupos.map((g) => ({
        formaPagoId: g.formaPagoId,
        _sum: { importeTotal: g.importe === null ? null : decimal(g.importe) },
      })),
    )
    const findMany = vi.fn(async () => formas)
    const client = { pago: { groupBy }, formaPago: { findMany } } as unknown as Cliente
    return { client, groupBy, findMany }
  }

  const FORMAS = [
    { id: 1, tipoFormaPago: 'EFECTIVO' },
    { id: 2, tipoFormaPago: 'TRANSFERENCIA' },
    { id: 3, tipoFormaPago: 'DEBITO' },
  ]

  it('cada forma con su total, por su código, en `number`', async () => {
    const { client } = clienteConGrupos(
      [
        { formaPagoId: 1, importe: 30001.5 },
        { formaPagoId: 2, importe: 15000 },
        { formaPagoId: 3, importe: 7000 },
      ],
      FORMAS,
    )

    expect(await totalCobradoPorForma(client, PERIODO)).toEqual({
      EFECTIVO: 30001.5,
      TRANSFERENCIA: 15000,
      DEBITO: 7000,
    })
  })

  it('el mismo filtro que el total: sólo `VIGENTE`, por `fechaPago`, extremos incluidos', async () => {
    const { client, groupBy } = clienteConGrupos([], FORMAS)
    await totalCobradoPorForma(client, PERIODO)

    expect(groupBy).toHaveBeenCalledWith({
      by: ['formaPagoId'],
      where: {
        estado: 'VIGENTE',
        fechaPago: {
          gte: new Date('2026-09-28T00:00:00.000Z'),
          lte: new Date('2026-10-04T00:00:00.000Z'),
        },
      },
      _sum: { importeTotal: true },
    })
  })

  it('una forma sin pagos queda en 0; sin pagos, todo en 0 y sin leer las formas', async () => {
    const conEfectivo = clienteConGrupos([{ formaPagoId: 1, importe: 8000 }], FORMAS)
    expect(await totalCobradoPorForma(conEfectivo.client, PERIODO)).toEqual({
      EFECTIVO: 8000,
      TRANSFERENCIA: 0,
      DEBITO: 0,
    })

    const sinPagos = clienteConGrupos([], FORMAS)
    expect(await totalCobradoPorForma(sinPagos.client, PERIODO)).toEqual({
      EFECTIVO: 0,
      TRANSFERENCIA: 0,
      DEBITO: 0,
    })
    expect(sinPagos.findMany).not.toHaveBeenCalled()
  })

  it('con el filtro de los pagos realizados (T-98): los mismos pagos que el listado, sólo `VIGENTE`', async () => {
    const { client, groupBy } = clienteConGrupos([{ formaPagoId: 2, importe: 34000 }], FORMAS)

    const totales = await totalCobradoPorForma(client, {
      ...PERIODO,
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      formaPago: 'TRANSFERENCIA',
    })

    // Con forma de pago, las otras dos quedan en 0.
    expect(totales).toEqual({ EFECTIVO: 0, TRANSFERENCIA: 34000, DEBITO: 0 })
    expect(groupBy).toHaveBeenCalledWith({
      by: ['formaPagoId'],
      where: {
        estado: 'VIGENTE',
        fechaPago: {
          gte: new Date('2026-09-28T00:00:00.000Z'),
          lte: new Date('2026-10-04T00:00:00.000Z'),
        },
        alumnoId: 12,
        turnos: { some: { turno: { materiaId: 2, bloqueAgenda: { profesorId: 3 } } } },
        formaPago: { tipoFormaPago: 'TRANSFERENCIA' },
      },
      _sum: { importeTotal: true },
    })
  })

  it('una forma de pago con pagos y sin código → 500 que pide correr el seed', async () => {
    const { client } = clienteConGrupos(
      [{ formaPagoId: 9, importe: 100 }],
      [{ id: 9, tipoFormaPago: null }],
    )

    const error = await totalCobradoPorForma(client, PERIODO).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(500)
    expect(error.message).toMatch(/pnpm db:seed/)
  })
})

// T-98 (HU-36): el filtro de los pagos realizados. Es el `where` del listado (vigentes y anulados);
// los totales le suman `estado: 'VIGENTE'` (arriba).
describe('pagosDelFiltro', () => {
  const FECHA_PAGO = {
    gte: new Date('2026-10-01T00:00:00.000Z'),
    lte: new Date('2026-10-31T00:00:00.000Z'),
  }

  it('sólo el período: la fecha de pago con los dos extremos, sin estado ni otras claves', () => {
    expect(pagosDelFiltro({ desde: '2026-10-01', hasta: '2026-10-31' })).toStrictEqual({
      fechaPago: FECHA_PAGO,
    })
  })

  it('combinados: período, alumno, materia y profesor sobre el mismo turno y forma por código', () => {
    expect(
      pagosDelFiltro({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        alumnoId: 12,
        materiaId: 2,
        profesorId: 3,
        formaPago: 'DEBITO',
      }),
    ).toStrictEqual({
      fechaPago: FECHA_PAGO,
      alumnoId: 12,
      turnos: { some: { turno: { materiaId: 2, bloqueAgenda: { profesorId: 3 } } } },
      formaPago: { tipoFormaPago: 'DEBITO' },
    })
  })

  it('sólo la materia o sólo el profesor: algún turno que cumpla eso', () => {
    const periodo = { desde: '2026-10-01', hasta: '2026-10-31' }
    expect(pagosDelFiltro({ ...periodo, materiaId: 2 }).turnos).toStrictEqual({
      some: { turno: { materiaId: 2 } },
    })
    expect(pagosDelFiltro({ ...periodo, profesorId: 3 }).turnos).toStrictEqual({
      some: { turno: { bloqueAgenda: { profesorId: 3 } } },
    })
  })
})

// T-104 (HU-42): lo que la anulación lee del pago y de las otras transferencias.
describe('leerPagoParaAnular', () => {
  const decimal = (n: number) => ({ toNumber: () => n })
  const LORENZO = { id: 1, nombre: 'Lorenzo', apellido: 'Gutiérrez' }
  const LENGUA = { id: 4, nombre: 'Lengua' }
  const ECONOMIA = { id: 12, nombre: 'Economía' }

  function fila(cambios: Record<string, unknown> = {}) {
    return {
      id: 171,
      numeroComprobante: 171,
      estado: 'VIGENTE',
      importeTotal: decimal(15000),
      transferenciaOperacion: '0004829137',
      transferenciaBanco: 'Banco Macro',
      alumno: LORENZO,
      turnos: [
        {
          turnoId: 455,
          fechaOcurrencia: new Date('2026-09-15T00:00:00.000Z'),
          importeAplicado: decimal(8000),
          turno: { materia: ECONOMIA },
        },
        {
          turnoId: 419,
          fechaOcurrencia: new Date('2026-09-12T00:00:00.000Z'),
          importeAplicado: decimal(7000),
          turno: { materia: LENGUA },
        },
      ],
      ...cambios,
    }
  }

  /** Un cliente con el pago y las asistencias que devuelve la base (T-179). */
  function clienteConAsistencias(filaPago: unknown, asistencias: unknown[] = []) {
    const findUnique = vi.fn(async () => filaPago)
    const findMany = vi.fn(async () => asistencias)
    const client = {
      pago: { findUnique },
      asistenciaTurno: { findMany },
    } as unknown as Cliente
    return { client, findUnique, findMany }
  }

  it('el pago con su total, sus turnos por fecha (con lo cobrado) y la transferencia', async () => {
    const { client, findUnique } = clienteConAsistencias(fila())

    expect(await leerPagoParaAnular(client, 171)).toEqual({
      id: 171,
      numeroComprobante: 171,
      estado: 'VIGENTE',
      alumno: LORENZO,
      total: 15000,
      turnos: [
        { turnoId: 419, fecha: '2026-09-12', materia: LENGUA, importe: 7000, asistencia: null },
        { turnoId: 455, fecha: '2026-09-15', materia: ECONOMIA, importe: 8000, asistencia: null },
      ],
      transferencia: { operacion: '0004829137', banco: 'Banco Macro' },
    })
    expect(findUnique).toHaveBeenCalledTimes(1)
  })

  it('cada turno trae su asistencia, leída en una sola consulta con el mismo cliente', async () => {
    const { client, findMany } = clienteConAsistencias(fila(), [
      { turnoId: 455, fechaOcurrencia: new Date('2026-09-15T00:00:00.000Z'), estado: 'AUSENTE' },
      // Otra ocurrencia del mismo turno: no es de este pago.
      { turnoId: 419, fechaOcurrencia: new Date('2026-09-19T00:00:00.000Z'), estado: 'PRESENTE' },
    ])

    const pago = await leerPagoParaAnular(client, 171)

    expect(pago?.turnos.map((t) => [t.turnoId, t.asistencia])).toEqual([
      [419, null],
      [455, 'AUSENTE'],
    ])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { turnoId: 455, fechaOcurrencia: new Date('2026-09-15T00:00:00.000Z') },
            { turnoId: 419, fechaOcurrencia: new Date('2026-09-12T00:00:00.000Z') },
          ],
        },
      }),
    )
  })

  it('un pago que no es por transferencia: `transferencia: null`; un anulado lo dice', async () => {
    const { client } = clienteConAsistencias(
      fila({ estado: 'ANULADO', transferenciaOperacion: null, transferenciaBanco: null }),
    )

    expect(await leerPagoParaAnular(client, 171)).toMatchObject({
      estado: 'ANULADO',
      transferencia: null,
    })
  })

  it('el pago no existe → `null`, sin leer asistencias', async () => {
    const { client, findMany } = clienteConAsistencias(null)
    expect(await leerPagoParaAnular(client, 99)).toBeNull()
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('pagosConMismaTransferencia', () => {
  it('los otros pagos vigentes con la misma operación y banco, por número', async () => {
    const otros = [
      { id: 180, numeroComprobante: 180, alumno: { id: 7, nombre: 'Sofía', apellido: 'Paz' } },
    ]
    const findMany = vi.fn(async () => otros)
    const client = { pago: { findMany } } as unknown as Cliente

    const res = await pagosConMismaTransferencia(client, {
      operacion: '0004829137',
      banco: 'Banco Macro',
      excluirPagoId: 171,
    })

    expect(res).toEqual(otros)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        transferenciaOperacion: '0004829137',
        transferenciaBanco: 'Banco Macro',
        estado: 'VIGENTE',
        id: { not: 171 },
      },
      select: {
        id: true,
        numeroComprobante: true,
        alumno: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { numeroComprobante: 'asc' },
    })
  })
})
