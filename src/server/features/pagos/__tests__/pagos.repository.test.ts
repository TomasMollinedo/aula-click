import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, ValidationError } from '@/server/errors'
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
  adjuntoUpdateMany,
  pagoFindUnique,
  pagoFindMany,
  pagoCount,
  pagoGroupBy,
  formaPagoFindMany,
  adjuntoFindFirst,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  turnoFindMany: vi.fn(),
  materiaFindMany: vi.fn(),
  formaPagoFindFirst: vi.fn(),
  pagoCreate: vi.fn(),
  adjuntoUpdateMany: vi.fn(),
  pagoFindUnique: vi.fn(),
  pagoFindMany: vi.fn(),
  pagoCount: vi.fn(),
  pagoGroupBy: vi.fn(),
  formaPagoFindMany: vi.fn(),
  adjuntoFindFirst: vi.fn(),
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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    pago: {
      findUnique: pagoFindUnique,
      findMany: pagoFindMany,
      count: pagoCount,
      groupBy: pagoGroupBy,
    },
    formaPago: { findMany: formaPagoFindMany },
    comprobanteAdjunto: { findFirst: adjuntoFindFirst },
  },
}))
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
  comprobanteAdjunto: { updateMany: adjuntoUpdateMany },
}

const entrada: EntradaPago = {
  alumnoId: 12,
  ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
  fechaPago: '2026-10-05',
  medio: { formaPago: 'EFECTIVO', montoRecibido: 10000 },
  observaciones: null,
}

/** Las columnas de los otros medios, en `null`: un pago, un medio. */
const SIN_MEDIOS = {
  transferenciaOperacion: null,
  transferenciaBanco: null,
  transferenciaTitular: null,
  debitoRed: null,
  debitoCupon: null,
  debitoUltimos4: null,
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
  adjuntoUpdateMany.mockResolvedValue({ count: 1 })
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
      where: { tipoFormaPago: 'EFECTIVO', estado: 'ACTIVO' },
      select: { id: true },
    })
    expect(pagoCreate).toHaveBeenCalledWith({
      data: {
        alumnoId: 12,
        formaPagoId: 1,
        importeTotal: '8000.50',
        fechaPago: new Date('2026-10-05T00:00:00.000Z'),
        montoRecibido: '10000.00',
        ...SIN_MEDIOS,
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
    // Efectivo: sin comprobante adjunto.
    expect(adjuntoUpdateMany).not.toHaveBeenCalled()
  })

  it('transferencia: la forma por su código, sus datos sin monto recibido, y vincula el adjunto con el tx', async () => {
    formaPagoFindFirst.mockResolvedValue({ id: 2 })

    await pagosRepository.registrar(
      {
        ...entrada,
        medio: {
          formaPago: 'TRANSFERENCIA',
          transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: null },
          comprobanteAdjuntoId: 18,
        },
      },
      () => plan,
      actor,
    )

    expect(formaPagoFindFirst.mock.calls[0]?.[0].where).toEqual({
      tipoFormaPago: 'TRANSFERENCIA',
      estado: 'ACTIVO',
    })
    expect(pagoCreate.mock.calls[0]?.[0].data).toMatchObject({
      formaPagoId: 2,
      montoRecibido: null,
      transferenciaOperacion: '0004829137',
      transferenciaBanco: 'Banco Macro',
      transferenciaTitular: null,
      debitoRed: null,
      debitoCupon: null,
      debitoUltimos4: null,
    })
    // `vincularAdjunto` (T-95), después de crear el pago y dentro de la misma transacción.
    expect(adjuntoUpdateMany).toHaveBeenCalledWith({
      where: { id: 18, pagoId: null, estado: 'ACTIVO', createdById: 'usr_mesa' },
      data: { pagoId: 31, updatedById: 'usr_mesa' },
    })
    expect(pagoCreate.mock.invocationCallOrder[0]).toBeLessThan(
      adjuntoUpdateMany.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('débito: red, cupón y últimos 4; sin adjunto no vincula nada', async () => {
    await pagosRepository.registrar(
      {
        ...entrada,
        medio: {
          formaPago: 'DEBITO',
          debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
          comprobanteAdjuntoId: null,
        },
      },
      () => plan,
      actor,
    )

    expect(pagoCreate.mock.calls[0]?.[0].data).toMatchObject({
      montoRecibido: null,
      transferenciaOperacion: null,
      debitoRed: 'VISA_DEBITO',
      debitoCupon: '000123',
      debitoUltimos4: '1234',
    })
    expect(adjuntoUpdateMany).not.toHaveBeenCalled()
  })

  it('un adjunto que no se puede vincular → 400 ADJUNTO_INVALIDO y la transacción se deshace', async () => {
    adjuntoUpdateMany.mockResolvedValue({ count: 0 })

    const error = await pagosRepository
      .registrar(
        {
          ...entrada,
          medio: {
            formaPago: 'DEBITO',
            debito: { red: 'MAESTRO', cupon: '9', ultimos4: null },
            comprobanteAdjuntoId: 99,
          },
        },
        () => plan,
        actor,
      )
      .catch((e) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(error.details).toEqual([{ path: ['comprobanteAdjuntoId'], message: expect.any(String) }])
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

  it('sin la forma de pago activa → 500 que pide correr el seed, sin escribir', async () => {
    formaPagoFindFirst.mockResolvedValue(null)

    const error = await pagosRepository.registrar(entrada, () => plan, actor).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(500)
    expect(error.message).toMatch(/pnpm db:seed/)
    expect(pagoCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['por nombre de índice', { index: 'pago_turno_turno_id_fecha_ocurrencia_vigente_key' }],
    ['por campos', { fields: ['turno_id', 'fecha_ocurrencia', 'vigente'] }],
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
    ['índice viejo del único', { index: 'pago_turno_turno_id_fecha_ocurrencia_key' }],
    ['forma ilegible', undefined],
  ])('otra P2002 (%s) no se traduce', async (_, c) => {
    const original = p2002(c)
    pagoCreate.mockRejectedValue(original)

    await expect(pagosRepository.registrar(entrada, () => plan, actor)).rejects.toBe(original)
  })
})

// HU-23 y HU-42 (T-96): el comprobante con la forma de pago por su código, los datos de su medio y
// la anulación, leídos junto con el pago.
describe('buscarComprobante', () => {
  const decimal = (n: number) => ({ toNumber: () => n })
  const LAURA = { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' }

  function fila(cambios: Record<string, unknown> = {}) {
    return {
      id: 31,
      numeroComprobante: 1024,
      fechaPago: new Date('2026-10-05T00:00:00.000Z'),
      importeTotal: decimal(8000),
      montoRecibido: null,
      observaciones: null,
      createdAt: new Date('2026-10-05T14:30:00.000Z'),
      alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
      formaPago: { tipoFormaPago: 'EFECTIVO', nombre: 'Efectivo' },
      transferenciaOperacion: null,
      transferenciaBanco: null,
      transferenciaTitular: null,
      debitoRed: null,
      debitoCupon: null,
      debitoUltimos4: null,
      estado: 'VIGENTE',
      anulacion: null,
      createdBy: LAURA,
      turnos: [],
      ...cambios,
    }
  }

  it('efectivo: la forma por su código, sin datos de transferencia ni de débito, vigente', async () => {
    pagoFindUnique.mockResolvedValue(fila({ montoRecibido: decimal(10000) }))

    expect(await pagosRepository.buscarComprobante(31)).toMatchObject({
      montoRecibido: 10000,
      formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
      transferencia: null,
      debito: null,
      estado: 'VIGENTE',
      anulacion: null,
    })
  })

  it('transferencia: operación, banco y titular (null si no se cargó)', async () => {
    pagoFindUnique.mockResolvedValue(
      fila({
        formaPago: { tipoFormaPago: 'TRANSFERENCIA', nombre: 'Transferencia' },
        transferenciaOperacion: '0004829137',
        transferenciaBanco: 'Banco Macro',
      }),
    )

    expect(await pagosRepository.buscarComprobante(31)).toMatchObject({
      montoRecibido: null,
      formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
      transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: null },
      debito: null,
    })
  })

  it('débito: red, cupón y últimos 4', async () => {
    pagoFindUnique.mockResolvedValue(
      fila({
        formaPago: { tipoFormaPago: 'DEBITO', nombre: 'Tarjeta de débito' },
        debitoRed: 'VISA_DEBITO',
        debitoCupon: '000123',
        debitoUltimos4: '1234',
      }),
    )

    expect(await pagosRepository.buscarComprobante(31)).toMatchObject({
      transferencia: null,
      debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
    })
  })

  it('anulado: el estado y la anulación con motivo, detalle, quién y cuándo', async () => {
    pagoFindUnique.mockResolvedValue(
      fila({
        estado: 'ANULADO',
        anulacion: {
          motivo: 'ERROR_CARGA',
          detalle: 'Se cargó dos veces',
          createdAt: new Date('2026-10-06T12:00:00.000Z'),
          createdBy: LAURA,
        },
      }),
    )

    expect(await pagosRepository.buscarComprobante(31)).toMatchObject({
      estado: 'ANULADO',
      anulacion: {
        motivo: 'ERROR_CARGA',
        detalle: 'Se cargó dos veces',
        anuladoPor: LAURA,
        anuladoEl: '2026-10-06T12:00:00.000Z',
      },
    })
    // La anulación sale de la misma consulta que el pago.
    expect(pagoFindUnique).toHaveBeenCalledTimes(1)
    expect(pagoFindUnique.mock.calls[0]?.[0].select.anulacion).toBeDefined()
  })

  it('una forma de pago sin código → 500 que pide correr el seed', async () => {
    pagoFindUnique.mockResolvedValue(fila({ formaPago: { tipoFormaPago: null, nombre: 'Vieja' } }))

    const error = await pagosRepository.buscarComprobante(31).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(500)
    expect(error.message).toMatch(/pnpm db:seed/)
  })

  it('inexistente → null', async () => {
    pagoFindUnique.mockResolvedValue(null)
    expect(await pagosRepository.buscarComprobante(99)).toBeNull()
  })
})

// T-98 (HU-36, HU-37): el listado de pagos realizados, "Mis pagos" y el adjunto del detalle. Fija
// el `where` (estado sólo en los totales), el orden, el `skip`/`take` y lo que se lee: sin base.
describe('pagos realizados', () => {
  const decimal = (n: number) => ({ toNumber: () => n })
  const MATEMATICA = { id: 2, nombre: 'Matemática' }
  const FISICA = { id: 7, nombre: 'Física' }

  /** Una fila de `pago.findMany` con lo que leen el listado y "Mis pagos". */
  function fila(parcial: Record<string, unknown> = {}) {
    return {
      id: 33,
      numeroComprobante: 1026,
      fechaPago: new Date('2026-10-06T00:00:00.000Z'),
      importeTotal: decimal(34000),
      estado: 'VIGENTE',
      formaPago: { tipoFormaPago: 'TRANSFERENCIA', nombre: 'Transferencia' },
      turnos: [
        { turno: { materia: MATEMATICA } },
        { turno: { materia: FISICA } },
        { turno: { materia: MATEMATICA } },
      ],
      alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez' },
      createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      anulacion: null,
      ...parcial,
    }
  }

  const FILTRO = {
    desde: '2026-10-01',
    hasta: '2026-10-31',
    alumnoId: 12,
    materiaId: 2,
    profesorId: 3,
    formaPago: 'TRANSFERENCIA' as const,
  }
  const WHERE_LISTADO = {
    fechaPago: {
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lte: new Date('2026-10-31T00:00:00.000Z'),
    },
    alumnoId: 12,
    turnos: { some: { turno: { materiaId: 2, bloqueAgenda: { profesorId: 3 } } } },
    formaPago: { tipoFormaPago: 'TRANSFERENCIA' },
  }

  beforeEach(() => {
    // La forma de arreglo de `$transaction`: las consultas ya armadas, en orden.
    transaction.mockImplementation((consultas: Promise<unknown>[]) => Promise.all(consultas))
    pagoFindMany.mockResolvedValue([fila()])
    pagoCount.mockResolvedValue(21)
    pagoGroupBy.mockResolvedValue([{ formaPagoId: 2, _sum: { importeTotal: decimal(34000) } }])
    formaPagoFindMany.mockResolvedValue([{ id: 2, tipoFormaPago: 'TRANSFERENCIA' }])
  })

  describe('listarRealizados', () => {
    it('la página con los filtros combinados, sin estado: lista vigentes y anulados', async () => {
      await pagosRepository.listarRealizados(FILTRO, { page: 3, pageSize: 10 })

      const consulta = pagoFindMany.mock.calls[0]?.[0]
      expect(consulta.where).toStrictEqual(WHERE_LISTADO)
      expect(consulta.where).not.toHaveProperty('estado')
      expect(pagoCount).toHaveBeenCalledExactlyOnceWith({ where: WHERE_LISTADO })
    })

    it('del más reciente al más antiguo, con `id` de desempate, y `skip`/`take` de la página', async () => {
      await pagosRepository.listarRealizados(FILTRO, { page: 3, pageSize: 10 })

      expect(pagoFindMany.mock.calls[0]?.[0]).toMatchObject({
        orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
      })
    })

    it('los totales: el mismo filtro más `estado: VIGENTE`, de todo el filtro (sin skip/take)', async () => {
      const res = await pagosRepository.listarRealizados(FILTRO, { page: 3, pageSize: 10 })

      expect(pagoGroupBy).toHaveBeenCalledExactlyOnceWith({
        by: ['formaPagoId'],
        where: { estado: 'VIGENTE', ...WHERE_LISTADO },
        _sum: { importeTotal: true },
      })
      expect(res.porForma).toEqual({ EFECTIVO: 0, TRANSFERENCIA: 34000, DEBITO: 0 })
    })

    it('cantidad fija de consultas: la página, el count, la suma por forma y las formas', async () => {
      pagoFindMany.mockResolvedValue([fila(), fila({ id: 32 }), fila({ id: 31 })])

      await pagosRepository.listarRealizados(FILTRO, { page: 1, pageSize: 10 })

      expect(pagoFindMany).toHaveBeenCalledTimes(1)
      expect(pagoCount).toHaveBeenCalledTimes(1)
      expect(pagoGroupBy).toHaveBeenCalledTimes(1)
      expect(formaPagoFindMany).toHaveBeenCalledTimes(1)
      expect(pagoFindUnique).not.toHaveBeenCalled()
      expect(adjuntoFindFirst).not.toHaveBeenCalled()
    })

    it('arma cada pago: materias distintas por nombre, cantidad, forma por código y la anulación', async () => {
      pagoFindMany.mockResolvedValue([
        fila({
          estado: 'ANULADO',
          anulacion: { motivo: 'ERROR_CARGA', detalle: 'Se cargó dos veces' },
        }),
      ])

      const res = await pagosRepository.listarRealizados(FILTRO, { page: 3, pageSize: 10 })

      expect(res.data).toEqual([
        {
          id: 33,
          numeroComprobante: 1026,
          fechaPago: '2026-10-06',
          alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez' },
          materias: [FISICA, MATEMATICA],
          cantidad: 3,
          total: 34000,
          formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
          registradoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
          estado: 'ANULADO',
          anulacion: { motivo: 'ERROR_CARGA', detalle: 'Se cargó dos veces' },
        },
      ])
      expect(res.meta).toEqual({ page: 3, pageSize: 10, total: 21, totalPages: 3 })
    })
  })

  describe('listarDelAlumno', () => {
    it('sólo los pagos del alumno, sin estado, con el mismo orden y la página', async () => {
      await pagosRepository.listarDelAlumno(12, { page: 2, pageSize: 5 })

      expect(pagoFindMany.mock.calls[0]?.[0]).toMatchObject({
        where: { alumnoId: 12 },
        orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 5,
      })
      expect(pagoCount).toHaveBeenCalledExactlyOnceWith({ where: { alumnoId: 12 } })
      expect(pagoGroupBy).not.toHaveBeenCalled()
    })

    it('no lee quién lo registró, el alumno, las observaciones ni la anulación', async () => {
      const res = await pagosRepository.listarDelAlumno(12, { page: 1, pageSize: 10 })

      const select = pagoFindMany.mock.calls[0]?.[0].select
      for (const campo of ['createdBy', 'alumno', 'observaciones', 'anulacion']) {
        expect(select).not.toHaveProperty(campo)
      }
      expect(res.data).toEqual([
        {
          id: 33,
          numeroComprobante: 1026,
          fechaPago: '2026-10-06',
          materias: [FISICA, MATEMATICA],
          cantidad: 3,
          total: 34000,
          formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
          estado: 'VIGENTE',
        },
      ])
    })
  })

  describe('buscarAdjunto', () => {
    it('el último activo, sin la clave del archivo', async () => {
      adjuntoFindFirst.mockResolvedValue({
        id: 18,
        archivoKey: 'adjuntos/abc.pdf',
        nombreArchivo: 'cupon.pdf',
        mimeType: 'application/pdf',
        bytes: 1024,
        createdAt: new Date('2026-10-05T14:28:00.000Z'),
        createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      })

      const adjunto = await pagosRepository.buscarAdjunto(31)

      expect(adjunto).toEqual({
        id: 18,
        nombre: 'cupon.pdf',
        tipo: 'application/pdf',
        bytes: 1024,
        adjuntadoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
        adjuntadoEl: '2026-10-05T14:28:00.000Z',
      })
      expect(adjuntoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pagoId: 31, estado: 'ACTIVO' } }),
      )
    })

    it('sin adjunto activo → null', async () => {
      adjuntoFindFirst.mockResolvedValue(null)
      expect(await pagosRepository.buscarAdjunto(31)).toBeNull()
    })
  })
})
