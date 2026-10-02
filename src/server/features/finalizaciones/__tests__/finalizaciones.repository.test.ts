import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { finalizacionesRepository } from '../finalizaciones.repository'
import type { PlanFinalizacion, SnapshotFinalizacion } from '../finalizaciones.reglas'
import type { EntradaFinalizacion } from '../finalizaciones.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad de la finalización
// que el service no puede observar (T-47): el lock del alumno es lo primero de la transacción, si
// `verificar` lanza no se escribe nada, nunca se modifica `Turno`, se inserta una finalización por
// cada turno del plan y la P2002 del único se traduce. Sin base: Prisma se reemplaza por un mock
// con `vi.hoisted`, y el error conocido de Prisma por una clase equivalente.

const {
  transaction,
  queryRaw,
  turnoFindUnique,
  turnoFindMany,
  turnoUpdate,
  turnoUpdateMany,
  pagoFindFirst,
  finalizacionCreateMany,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  turnoFindUnique: vi.fn(),
  turnoFindMany: vi.fn(),
  turnoUpdate: vi.fn(),
  turnoUpdateMany: vi.fn(),
  pagoFindFirst: vi.fn(),
  finalizacionCreateMany: vi.fn(),
  ErrorConocido: class extends Error {
    readonly code = 'P2002'
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))

const reloj = () => new Date('2026-10-05T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const tx = {
  $queryRaw: queryRaw,
  turno: {
    findUnique: turnoFindUnique,
    findMany: turnoFindMany,
    update: turnoUpdate,
    updateMany: turnoUpdateMany,
  },
  pagoTurno: { findFirst: pagoFindFirst },
  finalizacionRecurrencia: { createMany: finalizacionCreateMany },
}

const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const SERIE = '11111111-1111-4111-8111-111111111111'

/** Una fila `turno` como la lee `leerFilasDeLaSerie` del motor. */
function filaTurno(parcial: Record<string, unknown> = {}) {
  return {
    id: 41,
    serieId: null,
    bloqueAgendaId: 7,
    alumnoId: 12,
    tipo: 'RECURRENTE',
    estado: 'ACTIVO',
    fechaInicio: fecha('2026-10-05'),
    fechaFin: fecha('2026-11-30'),
    bloqueAgenda: { diaSemana: 1, horaInicio: 540, horaFin: 600 },
    finalizacion: null,
    ...parcial,
  }
}

const filaLeida = {
  turnoId: 41,
  serieId: null,
  bloqueAgendaId: 7,
  alumnoId: 12,
  tipo: 'RECURRENTE',
  activo: true,
  fechaInicio: '2026-10-05',
  fechaFin: '2026-11-30',
  diaSemana: 1,
  horaInicio: 540,
  horaFin: 600,
  finalizadaDesde: null,
}

const entrada: EntradaFinalizacion = {
  turnoId: 41,
  alumnoId: 12,
  fechaDesde: '2026-10-19',
  motivo: 'OTRO',
  detalle: 'Se muda',
}
const plan: PlanFinalizacion = {
  previa: {
    cantidad: 7,
    desde: '2026-10-19',
    hasta: '2026-11-30',
    pagadas: [],
    ultimaFechaPagada: null,
    fechaDesdeMinima: null,
    otrasHoras: [],
  },
  turnoIds: [41],
}

type Where = Record<string, unknown>
const whereDe = (llamada: number) =>
  (turnoFindMany.mock.calls[llamada]?.[0] as { where: Where }).where

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  queryRaw.mockResolvedValue([])
  turnoFindUnique.mockResolvedValue(filaTurno())
  turnoFindMany.mockResolvedValue([])
  pagoFindFirst.mockResolvedValue(null)
  finalizacionCreateMany.mockResolvedValue({ count: 1 })
})

describe('finalizar', () => {
  it('bloquea el alumno antes de cualquier lectura, relee e inserta la FinalizacionRecurrencia', async () => {
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PlanFinalizacion>(() => plan)

    const res = await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)

    expect(res).toBe(plan)
    expect(transaction.mock.calls[0]?.[1]).toEqual({ timeout: 10_000 })
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
    const lock = queryRaw.mock.invocationCallOrder[0] ?? Infinity
    expect(lock).toBeLessThan(turnoFindUnique.mock.invocationCallOrder[0] ?? -1)
    expect(lock).toBeLessThan(turnoFindMany.mock.invocationCallOrder[0] ?? -1)
    expect(lock).toBeLessThan(pagoFindFirst.mock.invocationCallOrder[0] ?? -1)

    expect(verificar).toHaveBeenCalledWith({
      turno: filaLeida,
      filas: [filaLeida],
      ocurrencias: [],
    })
    expect(verificar.mock.invocationCallOrder[0]).toBeLessThan(
      finalizacionCreateMany.mock.invocationCallOrder[0] ?? -1,
    )

    expect(finalizacionCreateMany).toHaveBeenCalledWith({
      data: [
        {
          turnoId: 41,
          fechaDesde: fecha('2026-10-19'),
          motivo: 'OTRO',
          detalle: 'Se muda',
          createdById: 'usr_mesa',
        },
      ],
    })
  })

  it('una FinalizacionRecurrencia por cada turno del plan, con la misma fechaDesde', async () => {
    await finalizacionesRepository.finalizar(
      entrada,
      () => ({ ...plan, turnoIds: [41, 58] }),
      actor,
      reloj,
    )

    const { data } = finalizacionCreateMany.mock.calls[0]?.[0] as {
      data: { turnoId: number; fechaDesde: Date }[]
    }
    expect(data.map((d) => d.turnoId)).toEqual([41, 58])
    expect(data.every((d) => d.fechaDesde.getTime() === fecha('2026-10-19').getTime())).toBe(true)
  })

  it('nunca modifica el turno: fechaFin queda como estaba', async () => {
    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(turnoUpdate).not.toHaveBeenCalled()
    expect(turnoUpdateMany).not.toHaveBeenCalled()
  })

  it('si verificar lanza, no se escribe nada', async () => {
    const error = new ConflictError('no', { code: 'TURNOS_PAGADOS' })

    await expect(
      finalizacionesRepository.finalizar(
        entrada,
        () => {
          throw error
        },
        actor,
        reloj,
      ),
    ).rejects.toBe(error)
    expect(finalizacionCreateMany).not.toHaveBeenCalled()
  })

  it('P2002 del único de turno_id → 409 "El turno ya fue finalizado"', async () => {
    finalizacionCreateMany.mockRejectedValue(new ErrorConocido('Unique constraint failed'))

    const error = await finalizacionesRepository
      .finalizar(entrada, () => plan, actor, reloj)
      .catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('CONFLICTO')
    expect(error.message).toBe('El turno ya fue finalizado')
    expect(error.details).toBeUndefined()
  })

  it('cualquier otro error se propaga tal cual', async () => {
    const original = new Error('boom')
    finalizacionCreateMany.mockRejectedValue(original)

    await expect(
      finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj),
    ).rejects.toBe(original)
  })
})

describe('snapshot (releído bajo lock)', () => {
  it('sin serieId: la serie es sólo el turno; lee sus ocurrencias desde max(hoy, fechaDesde) hasta su fechaFin', async () => {
    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(turnoFindUnique).toHaveBeenCalledTimes(1)
    // Una sola `findMany`: la del motor (`leerOcurrencias`), sólo este turno.
    expect(turnoFindMany).toHaveBeenCalledTimes(1)
    expect(whereDe(0).id).toEqual({ in: [41] })
    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-11-30') })
    expect(whereDe(0).OR).toEqual([{ fechaFin: null }, { fechaFin: { gte: fecha('2026-10-19') } }])
    expect(pagoFindFirst).toHaveBeenCalledWith({
      where: { turnoId: { in: [41] } },
      orderBy: { fechaOcurrencia: 'desc' },
      select: { fechaOcurrencia: true },
    })
  })

  it('con serieId: lee las filas de la serie (todas sus horas y tramos) y las ocurrencias de todas', async () => {
    turnoFindUnique.mockResolvedValue(filaTurno({ serieId: SERIE, fechaFin: fecha('2026-10-19') }))
    turnoFindMany.mockResolvedValueOnce([
      filaTurno({ serieId: SERIE, fechaFin: fecha('2026-10-19') }),
      filaTurno({ id: 58, serieId: SERIE, fechaInicio: fecha('2026-11-02') }),
      filaTurno({
        id: 42,
        serieId: SERIE,
        bloqueAgendaId: 8,
        bloqueAgenda: { diaSemana: 1, horaInicio: 600, horaFin: 660 },
        finalizacion: { fechaDesde: fecha('2026-11-16') },
      }),
    ])
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PlanFinalizacion>(() => plan)

    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)

    // 1ª: las filas de la serie.
    expect(whereDe(0)).toEqual({ serieId: SERIE, tipo: 'RECURRENTE', estado: 'ACTIVO' })
    // 2ª: el motor, con los turnos de la serie, hasta el mayor fin guardado.
    expect(whereDe(1).id).toEqual({ in: [41, 58, 42] })
    expect(whereDe(1).fechaInicio).toEqual({ lte: fecha('2026-11-30') })
    const snapshot = verificar.mock.calls[0]?.[0]
    expect(snapshot?.turno).toMatchObject({ turnoId: 41, serieId: SERIE, fechaFin: '2026-10-19' })
    expect(snapshot?.filas.map((f) => [f.turnoId, f.bloqueAgendaId, f.finalizadaDesde])).toEqual([
      [41, 7, null],
      [58, 7, null],
      [42, 8, '2026-11-16'],
    ])
  })

  it('sin fin: el horizonte es la fecha del último pago si es posterior a fechaDesde', async () => {
    turnoFindUnique.mockResolvedValue(filaTurno({ fechaFin: null }))
    pagoFindFirst.mockResolvedValue({ fechaOcurrencia: fecha('2026-11-09') })

    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-11-09') })
  })

  it('sin fin y sin pagos posteriores: el horizonte es fechaDesde', async () => {
    turnoFindUnique.mockResolvedValue(filaTurno({ fechaFin: null }))
    pagoFindFirst.mockResolvedValue({ fechaOcurrencia: fecha('2026-10-05') })

    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-10-19') })
  })

  it('una fechaDesde lejana en una serie sin fin no expande las semanas intermedias', async () => {
    turnoFindUnique.mockResolvedValue(filaTurno({ fechaFin: null }))

    await finalizacionesRepository.finalizar(
      { ...entrada, fechaDesde: '2027-10-04' },
      () => plan,
      actor,
      reloj,
    )

    // El rango leído es [fechaDesde, fechaDesde]: una sola fecha por turno.
    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2027-10-04') })
    expect(whereDe(0).OR).toEqual([{ fechaFin: null }, { fechaFin: { gte: fecha('2027-10-04') } }])
  })

  it('turno inexistente, o que ya no es un recurrente activo: lo ve verificar', async () => {
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PlanFinalizacion>(() => plan)

    turnoFindUnique.mockResolvedValue(null)
    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)
    expect(verificar).toHaveBeenLastCalledWith({ turno: null, filas: [], ocurrencias: [] })
    expect(turnoFindMany).not.toHaveBeenCalled()

    turnoFindUnique.mockResolvedValue(
      filaTurno({ tipo: 'SESION_UNICA', finalizacion: { fechaDesde: fecha('2026-11-02') } }),
    )
    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)
    expect(verificar.mock.lastCall?.[0]).toMatchObject({
      turno: { tipo: 'SESION_UNICA', finalizadaDesde: '2026-11-02' },
      filas: [],
      ocurrencias: [],
    })
    expect(turnoFindMany).not.toHaveBeenCalled()
  })
})
