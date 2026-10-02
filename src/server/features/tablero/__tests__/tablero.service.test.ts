import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ocurrencia, TableroRepository } from '../tablero.repository'
import { crearTableroService } from '../tablero.service'

// Service del tablero (T-61) con el repository mockeado y reloj fijo: viernes 02/10/2026 al
// mediodía en Salta. Los bordes de cada cuenta se prueban en `tablero.reglas`; acá, lo del service:
// un solo `hoy`, qué le pide al repository y con qué, y el DTO de cada indicador.

const reloj = () => new Date('2026-10-02T15:00:00Z')
const HOY = '2026-10-02'

const ESTA_SEMANA = { desde: '2026-09-28', hasta: '2026-10-04' }
const SEMANA_PASADA = { desde: '2026-09-21', hasta: '2026-09-27' }
const SEMANA_QUE_VIENE = { desde: '2026-10-05', hasta: '2026-10-11' }

const NOMBRES: Record<number, string> = {
  1: 'Álgebra',
  2: 'Matemática',
  3: 'Física',
  4: 'Química',
  5: 'Inglés',
  6: 'Lengua',
  7: 'Biología',
}

let turnoId = 0

function ocurrencia(
  fecha: string,
  estado: Ocurrencia['estado'],
  { bloqueAgendaId = 10, materiaId = 2 }: { bloqueAgendaId?: number; materiaId?: number } = {},
): Ocurrencia {
  turnoId += 1
  return {
    turnoId,
    fecha,
    bloqueAgendaId,
    diaSemana: 1,
    horaInicio: 540,
    horaFin: 600,
    profesorId: 3,
    aulaId: 1,
    alumnoId: turnoId,
    materiaId,
    tipo: 'SESION_UNICA',
    estado,
    pago: { estado: 'PENDIENTE' },
    serie: { serieId: null, fechaInicio: fecha, fechaFin: fecha, finEfectivo: fecha },
    alumno: { id: turnoId, nombre: `Alumno${turnoId}`, apellido: 'Paz', busqueda: 'paz' },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez', busqueda: 'gomez ana' },
    materia: { id: materiaId, nombre: NOMBRES[materiaId] ?? `Materia ${materiaId}` },
    aula: { id: 1, nombre: 'Aula 1' },
  }
}

const repetir = (cantidad: number, crear: () => Ocurrencia) =>
  Array.from({ length: cantidad }, crear)

let repository: {
  [K in keyof TableroRepository]: ReturnType<typeof vi.fn<TableroRepository[K]>>
}
let service: ReturnType<typeof crearTableroService>

beforeEach(() => {
  turnoId = 0
  repository = {
    ocurrenciasDelPeriodo: vi
      .fn<TableroRepository['ocurrenciasDelPeriodo']>()
      .mockResolvedValue([]),
    capacidadesDeBloques: vi
      .fn<TableroRepository['capacidadesDeBloques']>()
      .mockResolvedValue(new Map()),
    contarAlumnosNuevos: vi.fn<TableroRepository['contarAlumnosNuevos']>().mockResolvedValue(0),
    totalCobrado: vi.fn<TableroRepository['totalCobrado']>().mockResolvedValue(0),
    totalAdeudado: vi.fn<TableroRepository['totalAdeudado']>().mockResolvedValue(0),
  }
  service = crearTableroService({ repository, reloj })
})

describe('período y hoy', () => {
  it('devuelve el período pedido y la fecha de hoy del reloj', async () => {
    const tablero = await service.obtener(ESTA_SEMANA)

    expect(tablero.periodo).toEqual(ESTA_SEMANA)
    expect(tablero.hoy).toBe(HOY)
  })

  it('"hoy" es el de Salta: a las 02:00Z del 03/10 todavía es 02/10', async () => {
    const service = crearTableroService({
      repository,
      reloj: () => new Date('2026-10-03T02:00:00Z'),
    })

    expect((await service.obtener(ESTA_SEMANA)).hoy).toBe(HOY)
    expect(repository.totalAdeudado).toHaveBeenCalledExactlyOnceWith({ hoy: HOY })
  })

  it('lee las ocurrencias una sola vez, del período entero, sin filtros y con el reloj del service', async () => {
    await service.obtener(ESTA_SEMANA)

    expect(repository.ocurrenciasDelPeriodo).toHaveBeenCalledExactlyOnceWith(ESTA_SEMANA, reloj)
  })

  it('período sin nada → todo en 0, sin dividir por cero ni consultar capacidades de nada', async () => {
    const tablero = await service.obtener(ESTA_SEMANA)

    expect(tablero).toStrictEqual({
      periodo: ESTA_SEMANA,
      hoy: HOY,
      turnos: {
        total: 0,
        cancelados: { cantidad: 0, porcentaje: 0 },
        sinRegistrar: { cantidad: 0, porcentaje: 0 },
        agendados: { cantidad: 0, porcentaje: 0 },
        asistio: { disponible: false },
        noAsistio: { disponible: false },
      },
      ocupacion: { turnos: 0, capacidad: 0, porcentaje: 0 },
      alumnos: { nuevos: 0, atendidos: { disponible: false } },
      materiasConMasDemanda: [],
      profesoresConMasActividad: { disponible: false },
      pagos: { totalCobrado: 0, totalAdeudado: 0 },
    })
    expect(repository.capacidadesDeBloques).toHaveBeenCalledExactlyOnceWith([])
  })
})

describe('turnos por estado', () => {
  it('cantidad y porcentaje de cada estado sobre el total, con redondeo a un decimal', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ocurrencia('2026-09-28', 'CANCELADO'),
      ocurrencia('2026-09-29', 'SIN_REGISTRAR'),
      ocurrencia('2026-10-03', 'AGENDADO'),
    ])

    const { turnos } = await service.obtener(ESTA_SEMANA)

    expect(turnos.total).toBe(3)
    expect(turnos.cancelados).toEqual({ cantidad: 1, porcentaje: 33.3 })
    expect(turnos.sinRegistrar).toEqual({ cantidad: 1, porcentaje: 33.3 })
    expect(turnos.agendados).toEqual({ cantidad: 1, porcentaje: 33.3 })
  })

  it('período sólo pasado → `agendados: null`', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ocurrencia('2026-09-21', 'SIN_REGISTRAR'),
      ocurrencia('2026-09-22', 'CANCELADO'),
    ])

    const { turnos } = await service.obtener(SEMANA_PASADA)

    expect(turnos.agendados).toBeNull()
    expect(turnos.sinRegistrar).toEqual({ cantidad: 1, porcentaje: 50 })
    expect(turnos.cancelados).toEqual({ cantidad: 1, porcentaje: 50 })
  })

  it('período que termina hoy → incluye hoy: `agendados` con su cantidad', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ocurrencia('2026-10-01', 'SIN_REGISTRAR'),
      ocurrencia(HOY, 'AGENDADO'),
    ])

    const { turnos } = await service.obtener({ desde: '2026-09-28', hasta: HOY })

    expect(turnos.agendados).toEqual({ cantidad: 1, porcentaje: 50 })
  })

  it('período futuro sin turnos → `agendados` en 0, no `null`', async () => {
    const { turnos } = await service.obtener(SEMANA_QUE_VIENE)

    expect(turnos.agendados).toEqual({ cantidad: 0, porcentaje: 0 })
  })
})

describe('indicadores que dependen de la asistencia (HU-22)', () => {
  it('los cuatro son exactamente `{ disponible: false }`, aunque haya turnos pasados no cancelados', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue(
      repetir(4, () => ocurrencia('2026-09-22', 'SIN_REGISTRAR')),
    )
    repository.capacidadesDeBloques.mockResolvedValue(new Map([[10, 4]]))

    const tablero = await service.obtener(SEMANA_PASADA)

    // Hay con qué armar un sustituto ("turnos pasados no cancelados"): no se usa.
    expect(tablero.turnos.sinRegistrar.cantidad).toBe(4)
    expect(tablero.turnos.asistio).toStrictEqual({ disponible: false })
    expect(tablero.turnos.noAsistio).toStrictEqual({ disponible: false })
    expect(tablero.alumnos.atendidos).toStrictEqual({ disponible: false })
    expect(tablero.profesoresConMasActividad).toStrictEqual({ disponible: false })
  })
})

describe('ocupación', () => {
  it('turnos no cancelados sobre la capacidad de las clases; pide sólo los bloques con clase', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      // Bloque 10 (capacidad 4): una hora con dos alumnos cuenta su capacidad una sola vez.
      ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
      ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 }),
      // Bloque 11 (capacidad 2): otra clase, con un cancelado que no suma.
      ocurrencia('2026-09-29', 'SIN_REGISTRAR', { bloqueAgendaId: 11 }),
      ocurrencia('2026-09-29', 'CANCELADO', { bloqueAgendaId: 11 }),
      // Bloque 12: todos sus turnos cancelados, no es una clase.
      ocurrencia('2026-09-30', 'CANCELADO', { bloqueAgendaId: 12 }),
      ocurrencia('2026-09-30', 'CANCELADO', { bloqueAgendaId: 12 }),
    ])
    repository.capacidadesDeBloques.mockResolvedValue(
      new Map([
        [10, 4],
        [11, 2],
        [12, 6],
      ]),
    )

    const { ocupacion } = await service.obtener(ESTA_SEMANA)

    expect(ocupacion).toEqual({ turnos: 3, capacidad: 6, porcentaje: 50 })
    expect(repository.capacidadesDeBloques).toHaveBeenCalledExactlyOnceWith([10, 11])
  })

  it('las capacidades se piden después de leer las ocurrencias', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([ocurrencia('2026-09-28', 'SIN_REGISTRAR')])

    await service.obtener(ESTA_SEMANA)

    expect(repository.ocurrenciasDelPeriodo.mock.invocationCallOrder[0]).toBeLessThan(
      repository.capacidadesDeBloques.mock.invocationCallOrder[0] as number,
    )
  })

  it('sin clases → 0, sin pedir capacidades de ningún bloque', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([ocurrencia('2026-09-28', 'CANCELADO')])

    const { ocupacion } = await service.obtener(ESTA_SEMANA)

    expect(ocupacion).toEqual({ turnos: 0, capacidad: 0, porcentaje: 0 })
    expect(repository.capacidadesDeBloques).toHaveBeenCalledExactlyOnceWith([])
  })

  it('no recorta a 100', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue(
      repetir(3, () => ocurrencia('2026-09-28', 'SIN_REGISTRAR', { bloqueAgendaId: 10 })),
    )
    repository.capacidadesDeBloques.mockResolvedValue(new Map([[10, 2]]))

    expect((await service.obtener(ESTA_SEMANA)).ocupacion).toEqual({
      turnos: 3,
      capacidad: 2,
      porcentaje: 150,
    })
  })
})

describe('alumnos nuevos', () => {
  it('cuenta con los instantes del período en hora de Salta: de las 00:00 de `desde` a las 00:00 del día siguiente a `hasta`', async () => {
    repository.contarAlumnosNuevos.mockResolvedValue(3)

    const { alumnos } = await service.obtener(ESTA_SEMANA)

    expect(alumnos.nuevos).toBe(3)
    expect(repository.contarAlumnosNuevos).toHaveBeenCalledExactlyOnceWith(
      new Date('2026-09-28T03:00:00.000Z'),
      new Date('2026-10-05T03:00:00.000Z'),
    )
  })
})

describe('materias con más demanda', () => {
  const de = (
    materiaId: number,
    cantidad: number,
    estado: Ocurrencia['estado'] = 'SIN_REGISTRAR',
  ) => repetir(cantidad, () => ocurrencia('2026-09-28', estado, { materiaId }))

  it('hasta 5, por cantidad; el empate, por nombre; las canceladas no cuentan', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ...de(2, 5),
      ...de(3, 3),
      ...de(1, 3),
      ...de(5, 2),
      ...de(6, 2),
      ...de(7, 1),
      // Química tendría el primer puesto si las canceladas contaran.
      ...de(4, 9, 'CANCELADO'),
    ])

    const { materiasConMasDemanda } = await service.obtener(ESTA_SEMANA)

    expect(materiasConMasDemanda).toEqual([
      { materia: { id: 2, nombre: 'Matemática' }, cantidad: 5 },
      { materia: { id: 1, nombre: 'Álgebra' }, cantidad: 3 },
      { materia: { id: 3, nombre: 'Física' }, cantidad: 3 },
      { materia: { id: 5, nombre: 'Inglés' }, cantidad: 2 },
      { materia: { id: 6, nombre: 'Lengua' }, cantidad: 2 },
    ])
  })
})

describe('pagos', () => {
  it('`totalCobrado` es el del repository para el período, tal cual', async () => {
    repository.totalCobrado.mockResolvedValue(30001.5)

    const { pagos } = await service.obtener(ESTA_SEMANA)

    expect(pagos.totalCobrado).toBe(30001.5)
    expect(repository.totalCobrado).toHaveBeenCalledExactlyOnceWith(ESTA_SEMANA)
  })

  it('`totalAdeudado` se pide con exactamente `{ hoy }`: a la fecha, sin período ni filtros', async () => {
    repository.totalAdeudado.mockResolvedValue(296000.5)

    const { pagos } = await service.obtener(SEMANA_PASADA)

    expect(pagos.totalAdeudado).toBe(296000.5)
    expect(repository.totalAdeudado).toHaveBeenCalledTimes(1)
    expect(repository.totalAdeudado.mock.calls[0]).toStrictEqual([{ hoy: HOY }])
  })
})
