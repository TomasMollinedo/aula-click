import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { condicionTurnoSeCruzaCon, condicionTurnoVigente } from '../turnos.condiciones'
import { turnosRepository } from '../turnos.repository'
import { seCruzaCon } from '../turnos.reglas'
import type { EntradaReserva, PlanReserva, TurnoFechas } from '../turnos.validation'
import {
  crearTurnosEnMemoria,
  d,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from './turnos-en-memoria'

// Condiciones de consulta que otras features reutilizan (vigente, se cruza con), las lecturas de
// vigentes y de ocupación (que cuentan con el motor de ocurrencias, T-30) y la atomicidad de la
// reserva. Sin base: Prisma se reemplaza por un mock. `turno.findMany` consulta una tabla en
// memoria que aplica el `where` (`turnos-en-memoria.ts`), así se prueban el prefiltro y la regla.

const { findMany, findUnique, bloqueFindMany, tx, transaction, log } = vi.hoisted(() => {
  const log: string[] = []
  return {
    log,
    findMany: vi.fn(),
    bloqueFindMany: vi.fn(),
    findUnique: vi.fn(),
    transaction: vi.fn(),
    tx: {
      $queryRaw: vi.fn((...args: unknown[]) => {
        void args
        log.push('queryRaw')
        return Promise.resolve([])
      }),
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
    turno: { findMany, findUnique },
    bloqueAgenda: { findMany: bloqueFindMany },
    // La interactiva (reservar) corre el callback con `tx`.
    $transaction: (arg: (cliente: typeof tx) => Promise<unknown>, opciones?: unknown) => {
      transaction(opciones)
      return arg(tx)
    },
  },
}))

// HOY es martes 22/09/2026. Los lunes siguientes: 28/09, 05/10, 12/10, 19/10…
const HOY = '2026-09-22'
const MEDIANOCHE_HOY = new Date('2026-09-22T00:00:00.000Z')

const BLOQUES: BloqueDePrueba[] = [
  { id: 10, profesorId: 3, aulaId: 1, diaSemana: 1, horaInicio: 540 }, // lunes 9–10
  { id: 11, profesorId: 3, aulaId: 1, diaSemana: 1, horaInicio: 600 }, // lunes 10–11
  { id: 12, profesorId: 3, aulaId: 1, diaSemana: 2, horaInicio: 540, estado: 'INACTIVO' },
  { id: 20, profesorId: 7, aulaId: 2, diaSemana: 1, horaInicio: 540 }, // otro profesor
]

/**
 * Carga la tabla de turnos que consulta `prisma.turno.findMany`. `bloqueAgenda.findMany` (las
 * horas de `ocupacionMaximaPorFila`) devuelve las filas activas del profesor que tienen turnos.
 */
function sembrar(turnos: TurnoDePrueba[]) {
  const base = crearTurnosEnMemoria(BLOQUES, turnos)
  findMany.mockImplementation(base.findMany)
  bloqueFindMany.mockImplementation(async ({ where }: { where: { profesorId: number } }) =>
    BLOQUES.filter(
      (b) =>
        b.profesorId === where.profesorId &&
        (b.estado ?? 'ACTIVO') === 'ACTIVO' &&
        turnos.some((t) => t.bloqueAgendaId === b.id),
    )
      .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio - b.horaInicio || a.id - b.id)
      .map((b) => ({
        id: b.id,
        diaSemana: b.diaSemana,
        horaInicio: b.horaInicio,
        horaFin: b.horaFin ?? b.horaInicio + 60,
      })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  log.length = 0
  sembrar([])
})

// ---------------------------------------------------------------------------------------------
// Condiciones (prefiltros)
// ---------------------------------------------------------------------------------------------

describe('condicionTurnoVigente (prefiltro)', () => {
  it('ACTIVO, fechaFin nula o >= hoy, y sin finalización o finalizado después de hoy', () => {
    expect(condicionTurnoVigente(HOY)).toEqual({
      estado: 'ACTIVO',
      AND: [
        { OR: [{ fechaFin: null }, { fechaFin: { gte: MEDIANOCHE_HOY } }] },
        {
          OR: [
            { finalizacion: { is: null } },
            { finalizacion: { is: { fechaDesde: { gt: MEDIANOCHE_HOY } } } },
          ],
        },
      ],
    })
  })

  it('se sigue pudiendo mezclar por spread con bloqueAgenda y materiaId (como alumnos.listarDeProfesor)', () => {
    const condicionDelProfesor = { ...condicionTurnoVigente(HOY), bloqueAgenda: { profesorId: 3 } }
    const where = { ...condicionDelProfesor, materiaId: 2 }
    expect(Object.keys(where).sort()).toEqual(['AND', 'bloqueAgenda', 'estado', 'materiaId'])
    expect(where.AND).toEqual(condicionTurnoVigente(HOY).AND)
  })
})

describe('condicionTurnoSeCruzaCon', () => {
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

  /**
   * Evalúa en memoria el `where` que arma la condición (solo las claves que usa), para fijar que
   * dice lo mismo que el predicado puro de `turnos.reglas.ts`.
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

// ---------------------------------------------------------------------------------------------
// Vigentes (regla completa: alguna ocurrencia no cancelada entre hoy y el fin efectivo)
// ---------------------------------------------------------------------------------------------

describe('contarVigentesPorMateria', () => {
  it('filtra por profesor (el del bloque) y materias, agrupa por materia y devuelve la cantidad', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, materiaId: 2, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 11, materiaId: 2, fechaInicio: '2026-09-28', fechaFin: null },
      {
        id: 3,
        bloqueAgendaId: 10,
        materiaId: 7,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
      },
      { id: 4, bloqueAgendaId: 20, materiaId: 2, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 5, bloqueAgendaId: 10, materiaId: 9, fechaInicio: '2026-09-28', fechaFin: null },
    ])

    const resultado = await turnosRepository.contarVigentesPorMateria({
      fechaHoy: HOY,
      profesorId: 3,
      materiaIds: [2, 7],
    })

    expect(resultado).toEqual([
      { materiaId: 2, cantidad: 2 },
      { materiaId: 7, cantidad: 1 },
    ])
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('sin filtros opcionales, cuenta todos los vigentes', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, materiaId: 2, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 4, bloqueAgendaId: 20, materiaId: 2, fechaInicio: '2026-09-28', fechaFin: null },
    ])
    expect(await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY })).toEqual([
      { materiaId: 2, cantidad: 2 },
    ])
  })
})

describe('contarVigentesPorMateria por alumno', () => {
  it('sólo los turnos vigentes de ese alumno; con profesorId, sólo los que tiene con él', async () => {
    sembrar([
      {
        id: 1,
        bloqueAgendaId: 10,
        alumnoId: 12,
        materiaId: 2,
        fechaInicio: '2026-09-28',
        fechaFin: null,
      },
      {
        id: 2,
        bloqueAgendaId: 20,
        alumnoId: 12,
        materiaId: 7,
        fechaInicio: '2026-09-28',
        fechaFin: null,
      },
      // Otro alumno: no cuenta.
      {
        id: 3,
        bloqueAgendaId: 10,
        alumnoId: 99,
        materiaId: 9,
        fechaInicio: '2026-09-28',
        fechaFin: null,
      },
      // Del alumno, pero finalizado: ya no es vigente.
      {
        id: 4,
        bloqueAgendaId: 11,
        alumnoId: 12,
        materiaId: 5,
        fechaInicio: '2026-09-07',
        fechaFin: null,
        finalizadaDesde: '2026-09-14',
      },
    ])

    expect(
      await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY, alumnoId: 12 }),
    ).toEqual([
      { materiaId: 2, cantidad: 1 },
      { materiaId: 7, cantidad: 1 },
    ])
    expect(
      await turnosRepository.contarVigentesPorMateria({
        fechaHoy: HOY,
        alumnoId: 12,
        profesorId: 3,
      }),
    ).toEqual([{ materiaId: 2, cantidad: 1 }])
  })
})

describe('vigente con el motor de ocurrencias (T-30)', () => {
  it('una serie finalizada o con todo lo restante cancelado no es vigente; una sin fin sí', async () => {
    sembrar([
      // Finalizada desde el lunes 28/09: su fin efectivo (27/09) ya pasó.
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-07',
        fechaFin: null,
        finalizadaDesde: '2026-09-28',
      },
      // Sus dos fechas restantes (28/09 y 05/10) están canceladas.
      {
        id: 2,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-14',
        fechaFin: '2026-10-05',
        cancelaciones: [{ fecha: '2026-09-28' }, { fecha: '2026-10-05' }],
      },
      // Sin fin, con cancelaciones: siempre vigente.
      {
        id: 3,
        bloqueAgendaId: 11,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-09-28' }, { fecha: '2026-10-05' }],
      },
    ])

    expect(await turnosRepository.contarVigentesPorBloque(10, HOY)).toBe(0)
    expect(await turnosRepository.contarVigentesPorBloques([10, 11], HOY)).toEqual([
      { bloqueAgendaId: 11, cantidad: 1 },
    ])
    expect((await turnosRepository.listarVigentesPorProfesor(3, HOY)).length).toBe(1)
    expect(await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY })).toEqual([
      { materiaId: 3, cantidad: 1 },
    ])
  })

  it('con los datos del Sprint 1 (sin cancelaciones ni finalizaciones) cuenta lo mismo que la condición de fechas', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-21', fechaFin: '2026-09-21' }, // ayer: no
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-09-22', fechaFin: '2026-09-22' }, // hoy: sí
      { id: 3, bloqueAgendaId: 10, fechaInicio: '2026-09-07', fechaFin: '2026-09-28' }, // sí
      { id: 4, bloqueAgendaId: 10, estado: 'CANCELADO', fechaInicio: '2026-09-28', fechaFin: null },
    ])
    expect(await turnosRepository.contarVigentesPorBloque(10, HOY)).toBe(2)
  })
})

describe('contarVigentesPorBloque', () => {
  it('cuenta los turnos vigentes de ese bloque puntual', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
      { id: 3, bloqueAgendaId: 11, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
    ])

    expect(await turnosRepository.contarVigentesPorBloque(10, HOY)).toBe(2)
  })
})

describe('contarVigentesPorBloques', () => {
  it('una sola consulta para todas las filas, agrupada por fila', async () => {
    sembrar([{ id: 1, bloqueAgendaId: 11, fechaInicio: '2026-09-28', fechaFin: null }])

    const resultado = await turnosRepository.contarVigentesPorBloques([10, 11], HOY)

    expect(resultado).toEqual([{ bloqueAgendaId: 11, cantidad: 1 }])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bloqueAgendaId: { in: [10, 11] } }),
      }),
    )
  })
})

describe('listarVigentesPorProfesor', () => {
  it('trae alumno, materia, tipo, fechas y horario de cada turno vigente del profesor, por fecha e id', async () => {
    sembrar([
      {
        id: 2,
        bloqueAgendaId: 10,
        alumnoId: 12,
        materiaId: 2,
        fechaInicio: '2026-09-28',
        fechaFin: null,
      },
      {
        id: 1,
        bloqueAgendaId: 11,
        alumnoId: 13,
        materiaId: 2,
        fechaInicio: '2026-09-22',
        fechaFin: '2026-09-22',
        tipo: 'SESION_UNICA',
      },
      { id: 3, bloqueAgendaId: 20, fechaInicio: '2026-09-28', fechaFin: null }, // otro profesor
    ])

    const resultado = await turnosRepository.listarVigentesPorProfesor(3, HOY)

    expect(resultado).toEqual([
      {
        alumno: { id: 13, nombre: 'Alumno13', apellido: 'Apellido13' },
        materia: { id: 2, nombre: 'Materia2' },
        tipo: 'SESION_UNICA',
        fecha: '2026-09-22',
        fechaFin: '2026-09-22',
        horaInicio: '10:00',
        horaFin: '11:00',
      },
      {
        alumno: { id: 12, nombre: 'Alumno12', apellido: 'Apellido12' },
        materia: { id: 2, nombre: 'Materia2' },
        tipo: 'RECURRENTE',
        fecha: '2026-09-28',
        fechaFin: null,
        horaInicio: '09:00',
        horaFin: '10:00',
      },
    ])
  })

  it('sin turnos vigentes, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarVigentesPorProfesor(3, HOY)).resolves.toEqual([])
  })
})

describe('ocupacionMaximaPorFila', () => {
  it('lee las horas activas del profesor con turnos vigentes y devuelve la ocupación máxima de cada una', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-12', fechaFin: '2026-10-12' },
      { id: 3, bloqueAgendaId: 12, fechaInicio: '2026-09-29', fechaFin: null }, // fila inactiva
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
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bloqueAgendaId: { in: [10] } }),
      }),
    )
  })

  it('sin horas con candidatos a vigente, no lee series', async () => {
    expect(await turnosRepository.ocupacionMaximaPorFila(3, HOY)).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('una hora cuyas series no son vigentes (todo lo restante cancelado) no viene', async () => {
    sembrar([
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-10-05',
        cancelaciones: [{ fecha: '2026-09-28' }, { fecha: '2026-10-05' }],
      },
    ])
    expect(await turnosRepository.ocupacionMaximaPorFila(3, HOY)).toEqual([])
  })

  it('una ocurrencia cancelada libera su lugar en la cuenta del máximo', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      {
        id: 2,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-12',
        cancelaciones: [{ fecha: '2026-10-12' }],
      },
    ])

    expect(await turnosRepository.ocupacionMaximaPorFila(3, HOY)).toEqual([
      expect.objectContaining({ bloqueId: 10, fecha: '2026-09-28', cantidad: 1 }),
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// Ocupación por par fila–fecha (horario de bloques y disponibilidad)
// ---------------------------------------------------------------------------------------------

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
          bloqueAgenda: {},
        },
      }),
    )
  })

  it('cuenta recurrentes en cada fecha de su rango y sesiones únicas solo en la suya', async () => {
    sembrar([
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
      { id: 3, bloqueAgendaId: 11, fechaInicio: '2026-09-07', fechaFin: '2026-09-28' },
    ])

    const resultado = await turnosRepository.contarOcupacionPorBloque([
      { bloqueAgendaId: 10, fecha: '2026-10-05' },
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
      { bloqueAgendaId: 11, fecha: '2026-10-05' },
    ])

    // La fila 11 no tiene ningún turno que ocupe lugar el 05/10: no viene.
    expect(resultado).toEqual([
      { bloqueAgendaId: 10, fecha: '2026-10-05', cantidad: 2 },
      { bloqueAgendaId: 10, fecha: '2026-10-12', cantidad: 1 },
    ])
  })

  it('una cancelación y una finalización liberan su lugar (T-30)', async () => {
    sembrar([
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-10-05' }],
      },
      {
        id: 2,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        finalizadaDesde: '2026-10-12',
      },
    ])

    expect(
      await turnosRepository.contarOcupacionPorBloque([
        { bloqueAgendaId: 10, fecha: '2026-10-05' },
        { bloqueAgendaId: 10, fecha: '2026-10-12' },
      ]),
    ).toEqual([
      { bloqueAgendaId: 10, fecha: '2026-10-05', cantidad: 1 },
      { bloqueAgendaId: 10, fecha: '2026-10-12', cantidad: 1 },
    ])
  })

  it('sin filas no consulta la base', async () => {
    expect(await turnosRepository.contarOcupacionPorBloque([])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
// Reserva
// ---------------------------------------------------------------------------------------------

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
        observaciones: null,
        temas: null,
        serieId: '11111111-1111-4111-8111-111111111111',
      },
      {
        bloqueAgendaId: 10,
        alumnoId: 12,
        materiaId: 3,
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
        fechaInicio: '2026-11-02',
        fechaFin: null,
        observaciones: null,
        temas: null,
        serieId: '11111111-1111-4111-8111-111111111111',
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

  /** Turnos que lee la transacción (ocupantes y superposición). */
  function sembrarTx(turnos: TurnoDePrueba[]) {
    const base = crearTurnosEnMemoria(
      [
        { id: 10, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 540 },
        { id: 11, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 600 },
        { id: 20, profesorId: 7, aulaId: 2, diaSemana: 1, horaInicio: 540 },
      ],
      turnos,
    )
    tx.turno.findMany.mockImplementation(async (args: Parameters<typeof base.findMany>[0]) => {
      log.push('turno.findMany')
      return 'select' in args && 'cancelaciones' in (args.select ?? {}) ? base.findMany(args) : []
    })
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
    sembrarTx([])
    tx.turno.createManyAndReturn.mockImplementation(
      conLog('turno.createManyAndReturn', [{ id: 55 }, { id: 56 }]),
    )
  })

  it('toma los tres locks con bloquearParaReserva (profesor, filas por id ordenadas, alumno) antes de leer o insertar', async () => {
    await turnosRepository.reservar(entrada, () => plan, actor)

    expect(log.slice(0, 3)).toEqual(['queryRaw', 'queryRaw', 'queryRaw'])
    expect(log.slice(3)).not.toContain('queryRaw')
    const [profesor, filas, alumno] = tx.$queryRaw.mock.calls.map(([partes, ...valores]) => ({
      sql: (partes as string[]).join('?'),
      valores,
    }))
    expect(profesor).toEqual({
      sql: 'SELECT id FROM profesor WHERE id = ? FOR SHARE',
      valores: [4],
    })
    expect(filas).toEqual({
      sql: 'SELECT id FROM bloque_agenda WHERE id = ANY(?::int[]) ORDER BY id FOR UPDATE',
      valores: [[10, 11]],
    })
    expect(alumno).toEqual({ sql: 'SELECT id FROM alumno WHERE id = ? FOR UPDATE', valores: [12] })
  })

  it('lee el snapshot con los locks tomados (series con fin efectivo y canceladas, superposición) y se lo pasa a planificar', async () => {
    sembrarTx([
      {
        id: 70,
        bloqueAgendaId: 10,
        alumnoId: 99,
        fechaInicio: '2026-10-05',
        fechaFin: null,
        finalizadaDesde: '2026-11-02',
        cancelaciones: [{ fecha: '2026-10-12' }],
      },
      // Del alumno, con otro profesor en la misma hora: choca el 12/10 (el 05/10 está cancelado).
      {
        id: 71,
        bloqueAgendaId: 20,
        alumnoId: 12,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-19',
        cancelaciones: [{ fecha: '2026-10-05' }],
      },
    ])
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
        {
          bloqueAgendaId: 10,
          estado: 'ACTIVO',
          fechaInicio: '2026-10-05',
          finEfectivo: '2026-11-01',
          canceladas: ['2026-10-12'],
        },
      ],
      turnosAlumno: [
        {
          id: 71,
          tipo: 'RECURRENTE',
          estado: 'ACTIVO',
          fechaInicio: '2026-10-05',
          fechaFin: '2026-10-19',
          diaSemana: 1,
          horaInicio: 540,
          horaFin: 600,
          profesor: { id: 7, nombre: 'Profe7', apellido: 'Apellido7' },
          materia: { id: 3, nombre: 'Materia3' },
        },
      ],
    })
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
    const resultado = await turnosRepository.reservar(entrada, () => plan, actor)

    // Cada fila se inserta con el `serieId` que decidió el plan (los dos tramos, el mismo).
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
      observaciones: null,
      temas: 'Repaso de fracciones',
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
      observaciones: null,
      temas: 'Repaso de fracciones',
      createdAt: '2026-09-24T13:45:00.000Z',
      updatedAt: '2026-09-24T13:45:00.000Z',
      createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      updatedBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
    })
  })
})
