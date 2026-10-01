import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { finalizacionesRepository } from '../finalizaciones.repository'
import type { SnapshotFinalizacion } from '../finalizaciones.reglas'
import type { EntradaFinalizacion, PreviaFinalizacion } from '../finalizaciones.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad de la finalización
// que el service no puede observar (T-47): el lock del alumno es lo primero de la transacción, si
// `verificar` lanza no se escribe nada, nunca se modifica `Turno` y la P2002 del único se traduce.
// Sin base: Prisma se reemplaza por un mock con `vi.hoisted`, y el error conocido de Prisma por
// una clase equivalente.

const {
  transaction,
  queryRaw,
  turnoFindUnique,
  turnoFindMany,
  turnoUpdate,
  turnoUpdateMany,
  finalizacionCreate,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  turnoFindUnique: vi.fn(),
  turnoFindMany: vi.fn(),
  turnoUpdate: vi.fn(),
  turnoUpdateMany: vi.fn(),
  finalizacionCreate: vi.fn(),
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
  finalizacionRecurrencia: { create: finalizacionCreate },
}

const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function filaTurno(parcial: Record<string, unknown> = {}) {
  return {
    id: 41,
    alumnoId: 12,
    materiaId: 3,
    bloqueAgendaId: 7,
    tipo: 'RECURRENTE',
    estado: 'ACTIVO',
    fechaInicio: fecha('2026-10-05'),
    fechaFin: fecha('2026-11-30'),
    bloqueAgenda: { diaSemana: 1 },
    finalizacion: null,
    pagoTurnos: [],
    ...parcial,
  }
}

const entrada: EntradaFinalizacion = {
  turnoId: 41,
  alumnoId: 12,
  fechaDesde: '2026-10-19',
  motivo: 'OTRO',
  detalle: 'Se muda',
}
const plan: PreviaFinalizacion = {
  cantidad: 7,
  desde: '2026-10-19',
  hasta: '2026-11-30',
  pagadas: [],
  ultimaFechaPagada: null,
  fechaDesdeMinima: null,
  otrosTramos: [],
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
  finalizacionCreate.mockResolvedValue({ id: 1 })
})

describe('finalizar', () => {
  it('bloquea el alumno antes de cualquier lectura, relee e inserta la FinalizacionRecurrencia', async () => {
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PreviaFinalizacion>(() => plan)

    const res = await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)

    expect(res).toBe(plan)
    expect(transaction.mock.calls[0]?.[1]).toEqual({ timeout: 10_000 })
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
    const lock = queryRaw.mock.invocationCallOrder[0] ?? Infinity
    expect(lock).toBeLessThan(turnoFindUnique.mock.invocationCallOrder[0] ?? -1)
    expect(lock).toBeLessThan(turnoFindMany.mock.invocationCallOrder[0] ?? -1)

    expect(verificar).toHaveBeenCalledWith({
      turno: {
        id: 41,
        alumnoId: 12,
        tipo: 'RECURRENTE',
        activo: true,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-11-30',
        diaSemana: 1,
        tieneFinalizacion: false,
      },
      ocurrencias: [],
      otrosTramos: [],
    })
    expect(verificar.mock.invocationCallOrder[0]).toBeLessThan(
      finalizacionCreate.mock.invocationCallOrder[0] ?? -1,
    )

    expect(finalizacionCreate).toHaveBeenCalledWith({
      data: {
        turnoId: 41,
        fechaDesde: fecha('2026-10-19'),
        motivo: 'OTRO',
        detalle: 'Se muda',
        createdById: 'usr_mesa',
      },
    })
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
    expect(finalizacionCreate).not.toHaveBeenCalled()
  })

  it('P2002 del único de turno_id → 409 "El turno ya fue finalizado"', async () => {
    finalizacionCreate.mockRejectedValue(new ErrorConocido('Unique constraint failed'))

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
    finalizacionCreate.mockRejectedValue(original)

    await expect(
      finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj),
    ).rejects.toBe(original)
  })
})

describe('snapshot (releído bajo lock)', () => {
  it('con fechaFin: lee las ocurrencias del turno desde hoy hasta fechaFin, y los tramos posteriores', async () => {
    turnoFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 58, fechaInicio: fecha('2026-12-14'), fechaFin: null }])
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PreviaFinalizacion>(() => plan)

    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)

    expect(turnoFindUnique).toHaveBeenCalledTimes(1)
    expect(turnoFindMany).toHaveBeenCalledTimes(2)
    // 1ª: el motor (`leerOcurrencias`), sólo este turno, en [max(hoy, fechaDesde), fechaFin].
    expect(whereDe(0).id).toEqual({ in: [41] })
    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-11-30') })
    expect(whereDe(0).OR).toEqual([{ fechaFin: null }, { fechaFin: { gte: fecha('2026-10-19') } }])
    // 2ª: los tramos posteriores del mismo alumno, materia y hora, sin finalizar.
    expect(whereDe(1)).toEqual({
      tipo: 'RECURRENTE',
      estado: 'ACTIVO',
      alumnoId: 12,
      materiaId: 3,
      bloqueAgendaId: 7,
      fechaInicio: { gt: fecha('2026-10-05') },
      finalizacion: { is: null },
      OR: [{ fechaFin: null }, { fechaFin: { gte: fecha('2026-10-19') } }],
    })
    expect(verificar.mock.calls[0]?.[0].otrosTramos).toEqual([
      { turnoId: 58, fechaInicio: '2026-12-14', fechaFin: null },
    ])
  })

  it('sin fin: el horizonte es la fecha del último pago si es posterior a fechaDesde', async () => {
    turnoFindUnique.mockResolvedValue(
      filaTurno({ fechaFin: null, pagoTurnos: [{ fechaOcurrencia: fecha('2026-11-09') }] }),
    )

    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-11-09') })
  })

  it('sin fin y sin pagos posteriores: el horizonte es fechaDesde', async () => {
    turnoFindUnique.mockResolvedValue(
      filaTurno({ fechaFin: null, pagoTurnos: [{ fechaOcurrencia: fecha('2026-10-05') }] }),
    )

    await finalizacionesRepository.finalizar(entrada, () => plan, actor, reloj)

    expect(whereDe(0).fechaInicio).toEqual({ lte: fecha('2026-10-19') })
  })

  it('turno inexistente o ya finalizado: lo ve verificar', async () => {
    const verificar = vi.fn<(snapshot: SnapshotFinalizacion) => PreviaFinalizacion>(() => plan)

    turnoFindUnique.mockResolvedValue(null)
    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)
    expect(verificar).toHaveBeenLastCalledWith({ turno: null, ocurrencias: [], otrosTramos: [] })
    expect(turnoFindMany).not.toHaveBeenCalled()

    turnoFindUnique.mockResolvedValue(filaTurno({ finalizacion: { id: 9 }, tipo: 'SESION_UNICA' }))
    await finalizacionesRepository.finalizar(entrada, verificar, actor, reloj)
    expect(verificar.mock.lastCall?.[0].turno).toMatchObject({
      tipo: 'SESION_UNICA',
      tieneFinalizacion: true,
    })
  })
})
