import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import { crearTurnosEnMemoria, d } from '@/server/features/turnos/__tests__/turnos-en-memoria'
import type { Actor } from '@/server/shared/actor'
import { reprogramacionesRepository } from '../reprogramaciones.repository'
import type {
  EntradaReprogramacion,
  PlanReprogramacion,
  SnapshotReprogramacion,
} from '../reprogramaciones.validation'

// Excepcional (arquitectura-backend.md → Tests): fija invariantes de atomicidad de la reprogramación
// que el service no puede observar (T-49): los locks son lo primero de la transacción, si
// `planificar` lanza no se escribe nada, y el plan se aplica en el orden que evita choques con los
// únicos (crear, editar el original, re-apuntar). Sin base: Prisma se reemplaza por un mock con
// `vi.hoisted`; `turno.findMany` consulta una tabla en memoria (el motor real lee las ocurrencias).

const { transaction, log, tx } = vi.hoisted(() => {
  const log: string[] = []
  const registrar = (nombre: string, resultado?: unknown) =>
    vi.fn((...args: unknown[]) => {
      log.push(`${nombre} ${JSON.stringify(args[0])}`)
      return Promise.resolve(resultado)
    })
  return {
    log,
    transaction: vi.fn(),
    tx: {
      $queryRaw: vi.fn((...args: unknown[]) => {
        void args
        log.push('queryRaw')
        return Promise.resolve([])
      }),
      turno: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: registrar('turno.update'),
      },
      bloqueAgenda: { findUnique: vi.fn() },
      profesor: { findUnique: vi.fn() },
      materia: { findUnique: vi.fn() },
      asignacionMateria: { findUnique: vi.fn() },
      cancelacionTurno: { updateMany: registrar('cancelacion.updateMany') },
      pagoTurno: { updateMany: registrar('pago.updateMany') },
      finalizacionRecurrencia: {
        updateMany: registrar('finalizacion.updateMany'),
        deleteMany: registrar('finalizacion.deleteMany'),
      },
    },
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (arg: (cliente: typeof tx) => Promise<unknown>, opciones?: unknown) => {
      transaction(opciones)
      return arg(tx)
    },
  },
}))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const reloj = () => new Date('2026-10-05T15:00:00Z')

const entrada: EntradaReprogramacion = {
  turnoId: 50,
  fecha: '2026-10-19',
  alumnoId: 12,
  bloqueOrigenId: 10,
  bloqueDestinoId: 30,
  profesorDestinoId: 7,
  fechaDestino: '2026-10-22',
}

const SERIE = '11111111-1111-4111-8111-111111111111'

const planMedio: PlanReprogramacion = {
  original: { fechaFin: '2026-10-12' },
  tramoNuevo: { fechaInicio: '2026-10-26', fechaFin: '2026-11-02', serieId: SERIE },
  sesionNueva: true,
  finalizacionAlTramo: true,
  borrarFinalizacion: false,
  reapuntarPosterioresAlTramo: true,
  moverPago: true,
  cambio: 'texto del cambio',
}

beforeEach(() => {
  vi.clearAllMocks()
  log.length = 0
  const base = crearTurnosEnMemoria(
    [
      { id: 10, profesorId: 3, aulaId: 1, diaSemana: 1, horaInicio: 540 },
      { id: 30, profesorId: 7, aulaId: 2, diaSemana: 4, horaInicio: 1020 },
    ],
    [
      {
        id: 50,
        bloqueAgendaId: 10,
        tipo: 'RECURRENTE',
        fechaInicio: '2026-10-05',
        fechaFin: '2026-11-02',
      },
    ],
  )
  tx.turno.findMany.mockImplementation((args: never) => {
    log.push('turno.findMany')
    return base.findMany(args)
  })
  tx.turno.findUnique.mockResolvedValue({
    materiaId: 3,
    observaciones: 'Viene con tarea',
    temas: 'Integrales',
    finalizacion: { id: 1 },
  })
  tx.bloqueAgenda.findUnique.mockResolvedValue({
    id: 30,
    estado: 'ACTIVO',
    profesorId: 7,
    diaSemana: 4,
    horaInicio: 1020,
    horaFin: 1080,
    aula: { capacidad: 10 },
  })
  tx.profesor.findUnique.mockResolvedValue({
    id: 7,
    capacidad: 3,
    usuario: { estado: 'ACTIVO', apellido: 'Ruiz' },
  })
  tx.materia.findUnique.mockResolvedValue({ estado: 'ACTIVO' })
  tx.asignacionMateria.findUnique.mockResolvedValue({ estado: 'ACTIVO' })
  tx.turno.create
    .mockImplementationOnce(() => Promise.resolve({ id: 100 }))
    .mockImplementationOnce(() => Promise.resolve({ id: 101 }))
})

describe('reprogramacionesRepository.reprogramar', () => {
  it('toma los locks antes de leer y relee con el motor: ocupación y superposición excluyen la propia ocurrencia', async () => {
    const planificar = vi.fn((snapshot: SnapshotReprogramacion) => {
      expect(snapshot.ocurrencia).toMatchObject({ turnoId: 50, fecha: '2026-10-19' })
      expect(snapshot.ocupacionDestino).toBe(0)
      expect(snapshot.superpuestas).toEqual([])
      return planMedio
    })

    await reprogramacionesRepository.reprogramar(entrada, planificar, actor, reloj)

    expect(log.slice(0, 3)).toEqual(['queryRaw', 'queryRaw', 'queryRaw'])
    expect(log.indexOf('turno.findMany')).toBeGreaterThan(2)
    expect(transaction).toHaveBeenCalledWith({ timeout: 10_000 })
  })

  it('aplica el plan: crea el tramo y la sesión única, edita el original y re-apunta lo que cambia de turno', async () => {
    const resultado = await reprogramacionesRepository.reprogramar(
      entrada,
      () => planMedio,
      actor,
      reloj,
    )

    expect(resultado).toEqual({ turnoId: 101, cambio: 'texto del cambio' })
    const [tramo, sesion] = tx.turno.create.mock.calls.map(([args]) => args.data)
    expect(tramo).toMatchObject({
      bloqueAgendaId: 10,
      tipo: 'RECURRENTE',
      // El tramo sigue en la serie del original; la sesión única queda fuera (T-103).
      serieId: SERIE,
      fechaInicio: d('2026-10-26'),
      fechaFin: d('2026-11-02'),
      observaciones: 'Viene con tarea',
      temas: 'Integrales',
      createdById: 'usr_mesa',
      updatedById: 'usr_mesa',
    })
    expect(sesion).toMatchObject({
      bloqueAgendaId: 30,
      tipo: 'SESION_UNICA',
      serieId: null,
      fechaInicio: d('2026-10-22'),
      fechaFin: d('2026-10-22'),
      createdById: 'usr_mesa',
    })
    expect(tx.turno.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { fechaFin: d('2026-10-12'), updatedById: 'usr_mesa' },
    })
    // Las posteriores al 19/10 van al tramo (100); el pago del 19/10, a la sesión (101) con la fecha nueva.
    const posteriores = { turnoId: 50, fechaOcurrencia: { gt: d('2026-10-19') } }
    expect(tx.cancelacionTurno.updateMany).toHaveBeenCalledWith({
      where: posteriores,
      data: { turnoId: 100 },
    })
    expect(tx.pagoTurno.updateMany).toHaveBeenNthCalledWith(1, {
      where: posteriores,
      data: { turnoId: 100 },
    })
    expect(tx.pagoTurno.updateMany).toHaveBeenNthCalledWith(2, {
      where: { turnoId: 50, fechaOcurrencia: d('2026-10-19') },
      data: { turnoId: 101, fechaOcurrencia: d('2026-10-22') },
    })
    expect(tx.finalizacionRecurrencia.updateMany).toHaveBeenCalledWith({
      where: { turnoId: 50 },
      data: { turnoId: 100 },
    })
  })

  it('una sesión única sólo se edita: nada se crea ni se re-apunta salvo su pago', async () => {
    const plan: PlanReprogramacion = {
      original: { bloqueAgendaId: 30, fechaInicio: '2026-10-22', fechaFin: '2026-10-22' },
      tramoNuevo: null,
      sesionNueva: false,
      finalizacionAlTramo: false,
      borrarFinalizacion: false,
      reapuntarPosterioresAlTramo: false,
      moverPago: true,
      cambio: 'x',
    }

    const resultado = await reprogramacionesRepository.reprogramar(
      entrada,
      () => plan,
      actor,
      reloj,
    )

    expect(resultado.turnoId).toBe(50)
    expect(tx.turno.create).not.toHaveBeenCalled()
    expect(tx.cancelacionTurno.updateMany).not.toHaveBeenCalled()
    expect(tx.pagoTurno.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { turnoId: 50, fechaOcurrencia: d('2026-10-19') },
      data: { turnoId: 50, fechaOcurrencia: d('2026-10-22') },
    })
  })

  it('su única fecha: el original pasa a sesión única y pierde el serieId', async () => {
    const plan: PlanReprogramacion = {
      original: {
        tipo: 'SESION_UNICA',
        bloqueAgendaId: 30,
        fechaInicio: '2026-10-22',
        fechaFin: '2026-10-22',
        serieId: null,
      },
      tramoNuevo: null,
      sesionNueva: false,
      finalizacionAlTramo: false,
      borrarFinalizacion: true,
      reapuntarPosterioresAlTramo: false,
      moverPago: false,
      cambio: 'x',
    }

    await reprogramacionesRepository.reprogramar(entrada, () => plan, actor, reloj)

    expect(tx.turno.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: {
        tipo: 'SESION_UNICA',
        bloqueAgendaId: 30,
        fechaInicio: d('2026-10-22'),
        fechaFin: d('2026-10-22'),
        serieId: null,
        updatedById: 'usr_mesa',
      },
    })
    expect(tx.finalizacionRecurrencia.deleteMany).toHaveBeenCalledWith({ where: { turnoId: 50 } })
  })

  it('si planificar lanza, no se escribe nada', async () => {
    const error = new ConflictError('sin lugar')

    await expect(
      reprogramacionesRepository.reprogramar(
        entrada,
        () => {
          throw error
        },
        actor,
        reloj,
      ),
    ).rejects.toBe(error)

    expect(tx.turno.create).not.toHaveBeenCalled()
    expect(tx.turno.update).not.toHaveBeenCalled()
    expect(tx.pagoTurno.updateMany).not.toHaveBeenCalled()
  })

  it('si el turno ya no está en la hora de origen que leyó el service → 409, sin escribir', async () => {
    const planificar = vi.fn(() => planMedio)

    await expect(
      reprogramacionesRepository.reprogramar(
        { ...entrada, bloqueOrigenId: 11 },
        planificar,
        actor,
        reloj,
      ),
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(planificar).not.toHaveBeenCalled()
    expect(tx.turno.update).not.toHaveBeenCalled()
  })
})
