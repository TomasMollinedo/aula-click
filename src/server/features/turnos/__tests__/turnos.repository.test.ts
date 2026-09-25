import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import {
  condicionTurnoOcupaLugar,
  condicionTurnoSeCruzaCon,
  condicionTurnoVigente,
} from '../turnos.condiciones'
import { turnosRepository } from '../turnos.repository'
import { ocupaLugarEn, seCruzaCon } from '../turnos.reglas'
import type { EntradaReserva, PlanReserva, TurnoFechas } from '../turnos.validation'

// Condiciones de consulta que otras features reutilizan (vigente, ocupa lugar, se cruza con) y la
// atomicidad de la reserva. Sin base: Prisma se reemplaza por un mock y se verifica lo que recibe.
// Que Postgres evalúe bien las condiciones lo garantizan `gte`/`lte` sobre columnas @db.Date.

const {
  log,
  groupBy,
  count,
  findMany,
  findUnique,
  materiaFindMany,
  bloqueFindMany,
  aulaFindMany,
  tx,
  transaction,
} = vi.hoisted(() => {
  const log: string[] = []
  const registrar =
    <T>(nombre: string, valor: () => T) =>
    (...args: unknown[]) => {
      log.push(nombre)
      void args
      return Promise.resolve(valor())
    }
  return {
    log,
    registrar,
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    materiaFindMany: vi.fn(),
    bloqueFindMany: vi.fn(),
    aulaFindMany: vi.fn(),
    transaction: vi.fn(),
    tx: {
      $queryRaw: vi.fn(registrar('queryRaw', () => [])),
      bloqueAgenda: { findMany: vi.fn() },
      profesor: { findUnique: vi.fn() },
      materia: { findUnique: vi.fn() },
      asignacionMateria: { findUnique: vi.fn() },
      turno: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
    },
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    turno: { groupBy, count, findMany, findUnique },
    materia: { findMany: materiaFindMany },
    bloqueAgenda: { findMany: bloqueFindMany },
    aula: { findMany: aulaFindMany },
    // Las dos formas de $transaction: la interactiva (reservar) corre el callback con `tx`; la de
    // arreglo (listados paginados) resuelve las consultas ya lanzadas por los mocks.
    $transaction: (
      arg: ((cliente: typeof tx) => Promise<unknown>) | Promise<unknown>[],
      opciones?: unknown,
    ) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      transaction(opciones)
      return arg(tx)
    },
  },
}))

const HOY = '2026-09-22'
const MEDIANOCHE_HOY = new Date('2026-09-22T00:00:00.000Z')
const d = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`)

beforeEach(() => {
  vi.clearAllMocks()
  log.length = 0
  groupBy.mockResolvedValue([])
  count.mockResolvedValue(0)
  findMany.mockResolvedValue([])
  materiaFindMany.mockResolvedValue([])
  aulaFindMany.mockResolvedValue([])
})

describe('condicionTurnoVigente', () => {
  it('solo turnos ACTIVO (un cancelado no cuenta)', () => {
    expect(condicionTurnoVigente(HOY).estado).toBe('ACTIVO')
  })

  it('recurrente sin fecha de fin, o con fin >= hoy (incluye el que termina exactamente hoy)', () => {
    expect(condicionTurnoVigente(HOY).OR).toEqual([
      { fechaFin: null },
      { fechaFin: { gte: MEDIANOCHE_HOY } },
    ])
  })

  it('una sesión única (fechaFin = fechaInicio) de hoy cumple fin >= hoy; la de ayer no', () => {
    const { gte } = condicionTurnoVigente(HOY).OR[1].fechaFin as { gte: Date }
    expect(new Date('2026-09-22T00:00:00.000Z') >= gte).toBe(true)
    expect(new Date('2026-09-21T00:00:00.000Z') >= gte).toBe(false)
  })
})

describe('condicionTurnoSeCruzaCon y condicionTurnoOcupaLugar', () => {
  it('se cruza con [inicio, fin]: ACTIVO, fechaInicio <= fin y fechaFin nula o >= inicio', () => {
    expect(condicionTurnoSeCruzaCon('2026-10-05', '2026-11-30')).toEqual({
      estado: 'ACTIVO',
      fechaInicio: { lte: d('2026-11-30') },
      OR: [{ fechaFin: null }, { fechaFin: { gte: d('2026-10-05') } }],
    })
  })

  it('sin fin: no limita fechaInicio', () => {
    expect(condicionTurnoSeCruzaCon('2026-10-05', null)).toEqual({
      estado: 'ACTIVO',
      OR: [{ fechaFin: null }, { fechaFin: { gte: d('2026-10-05') } }],
    })
  })

  it('ocupa lugar en una fecha: la misma condición con inicio = fin = esa fecha (sirve para recurrentes)', () => {
    expect(condicionTurnoOcupaLugar(HOY)).toEqual({
      estado: 'ACTIVO',
      fechaInicio: { lte: MEDIANOCHE_HOY },
      OR: [{ fechaFin: null }, { fechaFin: { gte: MEDIANOCHE_HOY } }],
    })
  })

  /**
   * Evalúa en memoria el `where` que arman las condiciones (solo las claves que usan), para fijar
   * que dicen lo mismo que los predicados puros de `turnos.reglas.ts`.
   */
  function cumple(where: ReturnType<typeof condicionTurnoSeCruzaCon>, turno: TurnoFechas) {
    const inicio = d(turno.fechaInicio)
    const fin = turno.fechaFin === null ? null : d(turno.fechaFin)
    const lte = where.fechaInicio?.lte ?? null
    return (
      turno.estado === where.estado &&
      (lte === null || inicio <= lte) &&
      where.OR.some((opcion) =>
        opcion.fechaFin === null ? fin === null : fin !== null && fin >= opcion.fechaFin.gte,
      )
    )
  }

  const turnos: TurnoFechas[] = [
    { estado: 'ACTIVO', fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
    { estado: 'ACTIVO', fechaInicio: '2026-10-05', fechaFin: '2026-10-19' },
    { estado: 'ACTIVO', fechaInicio: '2026-10-12', fechaFin: null },
    { estado: 'ACTIVO', fechaInicio: '2026-09-28', fechaFin: '2026-10-05' },
    { estado: 'CANCELADO', fechaInicio: '2026-10-05', fechaFin: null },
  ]
  const fechas = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']

  it('condicionTurnoOcupaLugar equivale a ocupaLugarEn en los bordes', () => {
    for (const turno of turnos) {
      for (const fecha of fechas) {
        expect(
          cumple(condicionTurnoOcupaLugar(fecha), turno),
          `${turno.fechaInicio} ${fecha}`,
        ).toBe(ocupaLugarEn(turno, fecha))
      }
    }
  })

  it('condicionTurnoSeCruzaCon equivale a seCruzaCon (con y sin fin)', () => {
    for (const turno of turnos) {
      for (const inicio of fechas) {
        for (const fin of [...fechas.filter((f) => f >= inicio), null]) {
          expect(cumple(condicionTurnoSeCruzaCon(inicio, fin), turno)).toBe(
            seCruzaCon(turno, inicio, fin),
          )
        }
      }
    }
  })
})

describe('contarVigentesPorMateria', () => {
  it('filtra por profesor (el del bloque) y materias, agrupa por materia y devuelve la cantidad', async () => {
    groupBy.mockResolvedValue([
      { materiaId: 2, _count: { _all: 3 } },
      { materiaId: 7, _count: { _all: 1 } },
    ])

    const resultado = await turnosRepository.contarVigentesPorMateria({
      fechaHoy: HOY,
      profesorId: 3,
      materiaIds: [2, 7],
    })

    expect(resultado).toEqual([
      { materiaId: 2, cantidad: 3 },
      { materiaId: 7, cantidad: 1 },
    ])
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['materiaId'],
        where: {
          ...condicionTurnoVigente(HOY),
          bloqueAgenda: { profesorId: 3 },
          materiaId: { in: [2, 7] },
        },
      }),
    )
  })

  it('sin filtros opcionales, cuenta todos los vigentes', async () => {
    await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY })

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: condicionTurnoVigente(HOY) }),
    )
  })
})

describe('contarVigentesPorBloque', () => {
  it('cuenta los turnos vigentes de ese bloque puntual', async () => {
    count.mockResolvedValue(2)

    const resultado = await turnosRepository.contarVigentesPorBloque(10, HOY)

    expect(resultado).toBe(2)
    expect(count).toHaveBeenCalledWith({
      where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: 10 },
    })
  })
})

describe('contarVigentesPorBloques', () => {
  it('una sola consulta para todas las filas, con la condición de vigente, agrupada por fila', async () => {
    groupBy.mockResolvedValue([{ bloqueAgendaId: 11, _count: { _all: 2 } }])

    const resultado = await turnosRepository.contarVigentesPorBloques([10, 11], HOY)

    expect(resultado).toEqual([{ bloqueAgendaId: 11, cantidad: 2 }])
    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bloqueAgendaId'],
        where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: { in: [10, 11] } },
      }),
    )
  })
})

describe('contarOcupacionPorBloque', () => {
  it('una sola consulta: turnos de esas filas que se cruzan con [min, max] de las fechas', async () => {
    await turnosRepository.contarOcupacionPorBloque([
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
      { bloqueAgendaId: 11, fecha: '2026-09-29' },
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
    ])

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...condicionTurnoSeCruzaCon('2026-09-29', '2026-10-12'),
          bloqueAgendaId: { in: [10, 11] },
        },
      }),
    )
  })

  it('cuenta recurrentes en cada fecha de su rango y sesiones únicas solo en la suya', async () => {
    findMany.mockResolvedValue([
      { bloqueAgendaId: 10, estado: 'ACTIVO', fechaInicio: d('2026-09-28'), fechaFin: null },
      {
        bloqueAgendaId: 10,
        estado: 'ACTIVO',
        fechaInicio: d('2026-10-05'),
        fechaFin: d('2026-10-05'),
      },
      {
        bloqueAgendaId: 11,
        estado: 'ACTIVO',
        fechaInicio: d('2026-09-01'),
        fechaFin: d('2026-09-29'),
      },
    ])

    const resultado = await turnosRepository.contarOcupacionPorBloque([
      { bloqueAgendaId: 10, fecha: '2026-10-05' },
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
      { bloqueAgendaId: 11, fecha: '2026-10-06' },
    ])

    // La fila 11 no tiene ningún turno que ocupe lugar el 06/10: no viene.
    expect(resultado).toEqual([
      { bloqueAgendaId: 10, fecha: '2026-10-05', cantidad: 2 },
      { bloqueAgendaId: 10, fecha: '2026-10-12', cantidad: 1 },
    ])
  })

  it('sin filas no consulta la base', async () => {
    expect(await turnosRepository.contarOcupacionPorBloque([])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('listarVigentesPorProfesor', () => {
  it('trae alumno, materia, tipo, fechas y horario de cada turno vigente del profesor', async () => {
    findMany.mockResolvedValue([
      {
        alumno: { id: 12, nombre: 'Lucía', apellido: 'González' },
        materia: { id: 2, nombre: 'Matemática' },
        tipo: 'RECURRENTE',
        fechaInicio: d('2026-09-28'),
        fechaFin: null,
        bloqueAgenda: { horaInicio: 540, horaFin: 600 },
      },
      {
        alumno: { id: 13, nombre: 'Tomás', apellido: 'Ruiz' },
        materia: { id: 2, nombre: 'Matemática' },
        tipo: 'SESION_UNICA',
        fechaInicio: d('2026-09-25'),
        fechaFin: d('2026-09-25'),
        bloqueAgenda: { horaInicio: 600, horaFin: 660 },
      },
    ])

    const resultado = await turnosRepository.listarVigentesPorProfesor(3, HOY)

    expect(resultado).toEqual([
      {
        alumno: { id: 12, nombre: 'Lucía', apellido: 'González' },
        materia: { id: 2, nombre: 'Matemática' },
        tipo: 'RECURRENTE',
        fecha: '2026-09-28',
        fechaFin: null,
        horaInicio: '09:00',
        horaFin: '10:00',
      },
      {
        alumno: { id: 13, nombre: 'Tomás', apellido: 'Ruiz' },
        materia: { id: 2, nombre: 'Matemática' },
        tipo: 'SESION_UNICA',
        fecha: '2026-09-25',
        fechaFin: '2026-09-25',
        horaInicio: '10:00',
        horaFin: '11:00',
      },
    ])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...condicionTurnoVigente(HOY), bloqueAgenda: { profesorId: 3 } },
      }),
    )
  })

  it('sin turnos vigentes, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarVigentesPorProfesor(3, HOY)).resolves.toEqual([])
  })
})

describe('ocupacionMaximaPorFila', () => {
  it('lee las horas activas del profesor con turnos vigentes y devuelve la ocupación máxima de cada una', async () => {
    bloqueFindMany.mockResolvedValue([
      {
        id: 10,
        diaSemana: 1,
        horaInicio: 540,
        horaFin: 600,
        turnos: [
          { estado: 'ACTIVO', fechaInicio: d('2026-09-28'), fechaFin: null },
          { estado: 'ACTIVO', fechaInicio: d('2026-10-12'), fechaFin: d('2026-10-12') },
        ],
      },
    ])

    const resultado = await turnosRepository.ocupacionMaximaPorFila(3, HOY)

    // HOY es martes 22/09: el primer lunes que cuenta es el 28/09.
    expect(resultado).toEqual([
      {
        bloqueId: 10,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        fecha: '2026-10-12',
        cantidad: 2,
      },
    ])
    expect(bloqueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          profesorId: 3,
          estado: 'ACTIVO',
          turnos: { some: condicionTurnoVigente(HOY) },
        },
      }),
    )
  })
})

describe('reservar', () => {
  const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
  const entrada: EntradaReserva = {
    alumnoId: 12,
    profesorId: 4,
    materiaId: 3,
    bloqueIds: [11, 10],
    fechaInicio: '2026-10-05',
    fechaFin: null,
  }
  const plan: PlanReserva = {
    turnos: [
      {
        bloqueAgendaId: 10,
        alumnoId: 12,
        materiaId: 3,
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-19',
        motivoConsulta: null,
      },
      {
        bloqueAgendaId: 10,
        alumnoId: 12,
        materiaId: 3,
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
        fechaInicio: '2026-11-02',
        fechaFin: null,
        motivoConsulta: null,
      },
    ],
    fechasSinTurno: [
      {
        bloqueId: 10,
        horaInicio: '09:00',
        horaFin: '10:00',
        fechas: ['2026-10-26'],
        completoDesde: null,
      },
    ],
  }
  const conLog =
    <T>(nombre: string, valor: T) =>
    () => {
      log.push(nombre)
      return Promise.resolve(valor)
    }

  beforeEach(() => {
    tx.bloqueAgenda.findMany.mockImplementation(
      conLog('bloqueAgenda.findMany', [
        {
          id: 10,
          estado: 'ACTIVO',
          profesorId: 4,
          diaSemana: 1,
          horaInicio: 540,
          horaFin: 600,
          aula: { capacidad: 6 },
        },
      ]),
    )
    tx.profesor.findUnique.mockImplementation(
      conLog('profesor.findUnique', { id: 4, capacidad: 5, usuario: { estado: 'ACTIVO' } }),
    )
    tx.materia.findUnique.mockImplementation(
      conLog('materia.findUnique', { id: 3, estado: 'ACTIVO' }),
    )
    tx.asignacionMateria.findUnique.mockImplementation(
      conLog('asignacion.findUnique', { estado: 'ACTIVO' }),
    )
    tx.turno.findMany.mockImplementation(conLog('turno.findMany', []))
    tx.turno.createManyAndReturn.mockImplementation(
      conLog('turno.createManyAndReturn', [{ id: 55 }, { id: 56 }]),
    )
  })

  it('toma los tres locks en orden (profesor, filas por id, alumno) antes de leer o insertar', async () => {
    await turnosRepository.reservar(entrada, () => plan, actor)

    expect(log.slice(0, 3)).toEqual(['queryRaw', 'queryRaw', 'queryRaw'])
    expect(log.slice(3)).not.toContain('queryRaw')
    const [profesor, filas, alumno] = tx.$queryRaw.mock.calls.map(
      ([sql]) => sql as { text: string; values: unknown[] },
    )
    expect(profesor?.text).toMatch(/FROM profesor WHERE id = \$1 FOR SHARE/)
    expect(profesor?.values).toEqual([4])
    expect(filas?.text).toMatch(/FROM bloque_agenda WHERE id IN \(\$1,\$2\) ORDER BY id FOR UPDATE/)
    expect(filas?.values).toEqual([11, 10])
    expect(alumno?.text).toMatch(/FROM alumno WHERE id = \$1 FOR UPDATE/)
    expect(alumno?.values).toEqual([12])
  })

  it('lee el snapshot con los locks tomados, incluidas materia y asignación, y se lo pasa a planificar', async () => {
    tx.turno.findMany
      .mockImplementationOnce(
        conLog('turno.findMany', [
          {
            bloqueAgendaId: 10,
            estado: 'ACTIVO',
            fechaInicio: d('2026-10-26'),
            fechaFin: d('2026-10-26'),
          },
        ]),
      )
      .mockImplementationOnce(conLog('turno.findMany', []))
    const planificar = vi.fn(() => plan)

    await turnosRepository.reservar(entrada, planificar, actor)

    expect(planificar).toHaveBeenCalledWith({
      filas: [
        {
          id: 10,
          estado: 'ACTIVO',
          profesorId: 4,
          diaSemana: 1,
          horaInicio: 540,
          horaFin: 600,
          aulaCapacidad: 6,
        },
      ],
      profesor: { id: 4, capacidad: 5, estado: 'ACTIVO' },
      materia: { id: 3, estado: 'ACTIVO' },
      asignacion: { estado: 'ACTIVO' },
      ocupantes: [
        { bloqueAgendaId: 10, estado: 'ACTIVO', fechaInicio: '2026-10-26', fechaFin: '2026-10-26' },
      ],
      turnosAlumno: [],
    })
    // Ocupantes de las filas pedidas y turnos del alumno en el mismo día y hora, cruzados con el rango.
    expect(tx.turno.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          ...condicionTurnoSeCruzaCon('2026-10-05', null),
          bloqueAgendaId: { in: [11, 10] },
        },
      }),
    )
    expect(tx.turno.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          ...condicionTurnoSeCruzaCon('2026-10-05', null),
          alumnoId: 12,
          bloqueAgenda: { OR: [{ diaSemana: 1, horaInicio: 540 }] },
        },
      }),
    )
    expect(tx.asignacionMateria.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profesorId_materiaId: { profesorId: 4, materiaId: 3 } } }),
    )
  })

  it('la transacción usa un timeout de 10 s (la espera de un lock no termina en 500)', async () => {
    await turnosRepository.reservar(entrada, () => plan, actor)
    expect(transaction).toHaveBeenCalledWith({ timeout: 10_000 })
  })

  it('si planificar lanza, no se inserta nada', async () => {
    const error = new ConflictError('lleno', { code: 'BLOQUE_LLENO' })

    await expect(
      turnosRepository.reservar(
        entrada,
        () => {
          throw error
        },
        actor,
      ),
    ).rejects.toBe(error)
    expect(tx.turno.createManyAndReturn).not.toHaveBeenCalled()
  })

  it('inserta lo planificado con la auditoría del actor y devuelve el detalle y las fechas sin turno', async () => {
    tx.turno.findMany
      .mockImplementationOnce(conLog('turno.findMany', []))
      .mockImplementationOnce(conLog('turno.findMany', []))
      .mockImplementationOnce(conLog('turno.findMany', []))

    const resultado = await turnosRepository.reservar(entrada, () => plan, actor)

    expect(tx.turno.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          ...plan.turnos[0],
          fechaInicio: d('2026-10-05'),
          fechaFin: d('2026-10-19'),
          createdById: 'usr_mesa',
          updatedById: 'usr_mesa',
        },
        {
          ...plan.turnos[1],
          fechaInicio: d('2026-11-02'),
          fechaFin: null,
          createdById: 'usr_mesa',
          updatedById: 'usr_mesa',
        },
      ],
      select: { id: true },
    })
    expect(tx.turno.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: [55, 56] } },
        orderBy: [{ bloqueAgenda: { horaInicio: 'asc' } }, { fechaInicio: 'asc' }, { id: 'asc' }],
      }),
    )
    expect(resultado).toEqual({ turnos: [], fechasSinTurno: plan.fechasSinTurno })
  })
})

describe('buscarDetalle', () => {
  it('arma el detalle con fechas, horario, profesor, aula y auditoría plana; null si no existe', async () => {
    findUnique.mockResolvedValueOnce(null)
    expect(await turnosRepository.buscarDetalle(99)).toBeNull()

    findUnique.mockResolvedValueOnce({
      id: 55,
      tipo: 'RECURRENTE',
      estado: 'ACTIVO',
      fechaInicio: d('2026-10-05'),
      fechaFin: null,
      motivoConsulta: null,
      bloqueAgendaId: 10,
      bloqueAgenda: {
        diaSemana: 1,
        horaInicio: 540,
        horaFin: 600,
        aula: { id: 3, nombre: 'Aula 3' },
        profesor: { id: 4, usuario: { nombre: 'Ana', apellido: 'Pérez' } },
      },
      alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
      materia: { id: 3, nombre: 'Matemática' },
      createdAt: new Date('2026-09-24T13:45:00.000Z'),
      updatedAt: new Date('2026-09-24T13:45:00.000Z'),
      createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      updatedBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
    })

    expect(await turnosRepository.buscarDetalle(55)).toEqual({
      id: 55,
      tipo: 'RECURRENTE',
      estado: 'ACTIVO',
      fechaInicio: '2026-10-05',
      fechaFin: null,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '10:00',
      bloqueId: 10,
      alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      materia: { id: 3, nombre: 'Matemática' },
      aula: { id: 3, nombre: 'Aula 3' },
      motivoConsulta: null,
      createdAt: '2026-09-24T13:45:00.000Z',
      updatedAt: '2026-09-24T13:45:00.000Z',
      createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      updatedBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
    })
  })
})

describe('listarAgenda', () => {
  function filaAgenda() {
    return {
      id: 15,
      estado: 'ACTIVO' as const,
      alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
      materia: { id: 2, nombre: 'Matemática' },
      bloqueAgenda: {
        horaInicio: 540,
        horaFin: 600,
        aula: { id: 1, nombre: 'Aula 1' },
        profesor: { id: 3, usuario: { apellido: 'Pérez', nombre: 'Ana' } },
      },
    }
  }

  it('arma el item con profesor, materia, aula y horario en HH:mm', async () => {
    findMany.mockResolvedValue([filaAgenda()])
    count.mockResolvedValue(1)

    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(resultado).toEqual({
      data: [
        {
          id: 15,
          alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
          profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
          materia: { id: 2, nombre: 'Matemática' },
          aula: { id: 1, nombre: 'Aula 1' },
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'ACTIVO',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })
  })

  it('filtra por el día de la semana de la fecha, sin filtros opcionales ni búsqueda', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    // 2026-09-22 es martes: diaSemanaISO = 2.
    const whereEsperado = {
      AND: [condicionTurnoOcupaLugar(HOY), { bloqueAgenda: { diaSemana: 2 } }],
    }
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: whereEsperado }))
    expect(count).toHaveBeenCalledWith({ where: whereEsperado })
  })

  it('combina los filtros de materia y aula en la segunda rama del AND', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      materiaId: 2,
      aulaId: 1,
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            condicionTurnoOcupaLugar(HOY),
            { bloqueAgenda: { diaSemana: 2, aulaId: 1 }, materiaId: 2 },
          ],
        },
      }),
    )
  })

  it('sin `terminos`, el AND tiene solo dos ramas: no agrega ninguna de búsqueda', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20, terminos: [] })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(2)
  })

  it('con `terminos`, agrega una tercera rama: todas las palabras en el alumno, o todas en el profesor', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      terminos: ['juan', 'gonz'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(3)
    expect(where.AND[2]).toEqual({
      OR: [
        {
          alumno: {
            AND: [{ busqueda: { contains: 'juan' } }, { busqueda: { contains: 'gonz' } }],
          },
        },
        {
          bloqueAgenda: {
            profesor: {
              usuario: {
                AND: [{ busqueda: { contains: 'juan' } }, { busqueda: { contains: 'gonz' } }],
              },
            },
          },
        },
      ],
    })
  })

  it('la condición de vigencia por fecha (fechaFin nula o >= fecha) se mantiene con `terminos`', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      terminos: ['juan'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND[0]).toEqual(condicionTurnoOcupaLugar(HOY))
  })

  it('filtra por profesorId (vista personal): va en la misma rama que aula y día de semana', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20, profesorId: 3 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [condicionTurnoOcupaLugar(HOY), { bloqueAgenda: { diaSemana: 2, profesorId: 3 } }],
        },
      }),
    )
  })

  it('con profesorId y `terminos`, la búsqueda es solo por alumno (sin OR por profesor)', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      profesorId: 3,
      terminos: ['juan'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(3)
    expect(where.AND[2]).toEqual({ alumno: { AND: [{ busqueda: { contains: 'juan' } }] } })
  })

  it('ordena por hora, dentro de la hora por profesor, y por id como desempate final', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { bloqueAgenda: { horaInicio: 'asc' } },
          { bloqueAgenda: { profesor: { usuario: { busqueda: 'asc' } } } },
          { id: 'asc' },
        ],
      }),
    )
  })

  it('pagina con calcularSkipTake y arma meta con armarMeta', async () => {
    count.mockResolvedValue(45)

    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 2, pageSize: 20 })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }))
    expect(resultado.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 })
  })

  it('sin turnos ese día, devuelve una página vacía', async () => {
    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(resultado).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })
  })
})

describe('listarMateriasConTurno', () => {
  it('devuelve las materias que trae Prisma, tal cual', async () => {
    materiaFindMany.mockResolvedValue([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])

    await expect(turnosRepository.listarMateriasConTurno(HOY)).resolves.toEqual([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])
  })

  it('filtra materias con algún turno que aplica esa fecha, en el día de semana del bloque', async () => {
    await turnosRepository.listarMateriasConTurno(HOY)

    // 2026-09-22 es martes: diaSemanaISO = 2.
    expect(materiaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          turnos: { some: { ...condicionTurnoOcupaLugar(HOY), bloqueAgenda: { diaSemana: 2 } } },
        },
      }),
    )
  })

  it('no filtra por el estado de la materia: importa si se dictó esa fecha, no si sigue activa', async () => {
    await turnosRepository.listarMateriasConTurno(HOY)

    const { where } = materiaFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).not.toHaveProperty('estado')
  })

  it('sin materias con turno ese día, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarMateriasConTurno(HOY)).resolves.toEqual([])
  })
})

describe('listarAulasConTurno', () => {
  it('devuelve las aulas que trae Prisma, tal cual', async () => {
    aulaFindMany.mockResolvedValue([
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ])

    await expect(turnosRepository.listarAulasConTurno(HOY)).resolves.toEqual([
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ])
  })

  it('filtra aulas con algún bloque en el día de semana con un turno que aplica esa fecha', async () => {
    await turnosRepository.listarAulasConTurno(HOY)

    // 2026-09-22 es martes: diaSemanaISO = 2.
    expect(aulaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bloques: { some: { diaSemana: 2, turnos: { some: condicionTurnoOcupaLugar(HOY) } } },
        },
      }),
    )
  })

  it('no filtra por el estado del aula: importa si se usó esa fecha, no si sigue activa', async () => {
    await turnosRepository.listarAulasConTurno(HOY)

    const { where } = aulaFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).not.toHaveProperty('estado')
  })

  it('sin aulas con turno ese día, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarAulasConTurno(HOY)).resolves.toEqual([])
  })
})
