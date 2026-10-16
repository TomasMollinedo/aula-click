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
  {
    bloqueAgendaId = 10,
    materiaId = 2,
    profesorId = 3,
    alumnoId,
    vencido,
  }: {
    bloqueAgendaId?: number
    materiaId?: number
    profesorId?: number
    alumnoId?: number
    /** El plazo de registro ya venció: un "Sin registrar" cerrado por el sistema. */
    vencido?: boolean
  } = {},
): Ocurrencia {
  turnoId += 1
  return {
    turnoId,
    fecha,
    bloqueAgendaId,
    diaSemana: 1,
    horaInicio: 540,
    horaFin: 600,
    profesorId,
    aulaId: 1,
    alumnoId: alumnoId ?? turnoId,
    materiaId,
    tipo: 'SESION_UNICA',
    estado,
    pago: { estado: 'PENDIENTE' },
    asistencia: null,
    plazoAsistencia: vencido === undefined ? null : { vence: '2026-10-05', vencido },
    serie: { serieId: null, fechaInicio: fecha, fechaFin: fecha, finEfectivo: fecha },
    alumno: {
      id: alumnoId ?? turnoId,
      nombre: `Alumno${turnoId}`,
      apellido: 'Paz',
      busqueda: 'paz',
    },
    profesor: {
      id: profesorId,
      nombre: profesorId === 3 ? 'Ana' : 'Luis',
      apellido: profesorId === 3 ? 'Gómez' : 'Pérez',
      busqueda: 'gomez ana',
    },
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
    totalCobradoPorForma: vi
      .fn<TableroRepository['totalCobradoPorForma']>()
      .mockResolvedValue({ EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 }),
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
        asistio: { cantidad: 0, porcentaje: 0 },
        noAsistio: { cantidad: 0, porcentaje: 0 },
      },
      ocupacion: { turnos: 0, capacidad: 0, porcentaje: 0 },
      alumnos: { nuevos: 0, atendidos: 0 },
      materiasConMasDemanda: [],
      profesoresConMasTurnos: [],
      pagos: {
        totalCobrado: 0,
        cobradoPorForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
        totalAdeudado: 0,
      },
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

describe('asistencia (HU-22, HU-39)', () => {
  it('asistió y no asistió: cantidad y porcentaje sobre los turnos con asistencia registrada', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ...repetir(3, () => ocurrencia('2026-09-28', 'REALIZADO')),
      ocurrencia('2026-09-29', 'AUSENTE'),
      // Fuera de la base del porcentaje, aunque sí están en `turnos.total`.
      ocurrencia('2026-09-29', 'SIN_REGISTRAR', { vencido: true }),
      ocurrencia('2026-10-03', 'AGENDADO'),
      ocurrencia('2026-09-30', 'CANCELADO'),
    ])

    const { turnos } = await service.obtener(ESTA_SEMANA)

    expect(turnos.asistio).toEqual({ cantidad: 3, porcentaje: 75 })
    expect(turnos.noAsistio).toEqual({ cantidad: 1, porcentaje: 25 })
    expect(turnos.total).toBe(7)
    expect(turnos.sinRegistrar.cantidad).toBe(1)
  })

  it('sin ninguna asistencia registrada → 0 de 0, sin dividir por cero', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue(
      repetir(4, () => ocurrencia('2026-09-22', 'SIN_REGISTRAR', { vencido: true })),
    )

    const { turnos, alumnos } = await service.obtener(SEMANA_PASADA)

    expect(turnos.asistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(turnos.noAsistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(alumnos.atendidos).toBe(0)
  })

  it('alumnos atendidos: distintos con al menos un turno realizado', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ocurrencia('2026-09-28', 'REALIZADO', { alumnoId: 7 }),
      ocurrencia('2026-09-29', 'REALIZADO', { alumnoId: 7 }),
      ocurrencia('2026-09-29', 'REALIZADO', { alumnoId: 8 }),
      // Sólo ausente o cerrado: no se lo atendió.
      ocurrencia('2026-09-29', 'AUSENTE', { alumnoId: 9 }),
      ocurrencia('2026-09-29', 'SIN_REGISTRAR', { alumnoId: 10, vencido: true }),
    ])

    expect((await service.obtener(ESTA_SEMANA)).alumnos.atendidos).toBe(2)
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

describe('profesores con más turnos', () => {
  const de = (
    profesorId: number,
    cantidad: number,
    estado: Ocurrencia['estado'] = 'SIN_REGISTRAR',
  ) => repetir(cantidad, () => ocurrencia('2026-09-28', estado, { profesorId }))

  it('por turnos no cancelados del período, con nombre y apellido del profesor', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ...de(3, 2),
      ...de(7, 3),
      // Ana tendría el primer puesto si las canceladas contaran.
      ...de(3, 9, 'CANCELADO'),
    ])

    const { profesoresConMasTurnos } = await service.obtener(ESTA_SEMANA)

    expect(profesoresConMasTurnos).toEqual([
      { profesor: { id: 7, nombre: 'Luis', apellido: 'Pérez' }, cantidad: 3 },
      { profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' }, cantidad: 2 },
    ])
  })

  it('no trae el campo interno `busqueda` del profesor', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue(de(3, 1))

    const { profesoresConMasTurnos } = await service.obtener(ESTA_SEMANA)

    expect(Object.keys(profesoresConMasTurnos[0]?.profesor ?? {}).sort()).toEqual([
      'apellido',
      'id',
      'nombre',
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

  it('`cobradoPorForma` trae las tres formas del repository para el período, con 0 en las que no hubo', async () => {
    repository.totalCobrado.mockResolvedValue(30001.5)
    repository.totalCobradoPorForma.mockResolvedValue({
      EFECTIVO: 20000,
      TRANSFERENCIA: 10001.5,
      DEBITO: 0,
    })

    const { pagos } = await service.obtener(ESTA_SEMANA)

    expect(pagos.cobradoPorForma).toStrictEqual({
      EFECTIVO: 20000,
      TRANSFERENCIA: 10001.5,
      DEBITO: 0,
    })
    expect(repository.totalCobradoPorForma).toHaveBeenCalledExactlyOnceWith(ESTA_SEMANA)
  })

  it('`totalAdeudado` se pide con exactamente `{ hoy }`: a la fecha, sin período ni filtros', async () => {
    repository.totalAdeudado.mockResolvedValue(296000.5)

    const { pagos } = await service.obtener(SEMANA_PASADA)

    expect(pagos.totalAdeudado).toBe(296000.5)
    expect(repository.totalAdeudado).toHaveBeenCalledTimes(1)
    expect(repository.totalAdeudado.mock.calls[0]).toStrictEqual([{ hoy: HOY }])
  })
})

describe('asistencia: GET /tablero/asistencia', () => {
  const PRIMERA_PAGINA = {
    desde: '2026-09-28',
    hasta: '2026-10-04',
    paginaProfesores: 1,
    paginaMaterias: 1,
    orden: 'cerradosSinRegistrar',
    direccion: 'desc',
  } as const

  /** Luis (7): 2 cerrados; Ana (3): 1 realizado y 1 pendiente; Marta (9): sólo cancelados. */
  function cargarEjemplo() {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ocurrencia('2026-09-22', 'SIN_REGISTRAR', { profesorId: 7, materiaId: 2, vencido: true }),
      ocurrencia('2026-09-22', 'SIN_REGISTRAR', { profesorId: 7, materiaId: 3, vencido: true }),
      ocurrencia('2026-09-28', 'REALIZADO', { profesorId: 3, materiaId: 2, vencido: false }),
      ocurrencia('2026-10-01', 'SIN_REGISTRAR', { profesorId: 3, materiaId: 2, vencido: false }),
      ocurrencia('2026-09-28', 'CANCELADO', { profesorId: 9, materiaId: 1 }),
    ])
  }

  it('lee las ocurrencias del período y las de la ventana de registro que termina hoy, con el reloj del service, y nada más', async () => {
    await service.obtenerAsistencia(PRIMERA_PAGINA)

    expect(repository.ocurrenciasDelPeriodo).toHaveBeenCalledTimes(2)
    expect(repository.ocurrenciasDelPeriodo).toHaveBeenNthCalledWith(1, ESTA_SEMANA, reloj)
    // Hoy es el 02/10: la ventana va de 7 días atrás a hoy.
    expect(repository.ocurrenciasDelPeriodo).toHaveBeenNthCalledWith(
      2,
      { desde: '2026-09-25', hasta: '2026-10-02' },
      reloj,
    )
    expect(repository.capacidadesDeBloques).not.toHaveBeenCalled()
    expect(repository.contarAlumnosNuevos).not.toHaveBeenCalled()
    expect(repository.totalCobrado).not.toHaveBeenCalled()
    expect(repository.totalCobradoPorForma).not.toHaveBeenCalled()
    expect(repository.totalAdeudado).not.toHaveBeenCalled()
  })

  it('período sin turnos → resumen en 0 y las dos tablas vacías (base 0, sin dividir por cero)', async () => {
    const respuesta = await service.obtenerAsistencia(PRIMERA_PAGINA)

    expect(respuesta).toStrictEqual({
      periodo: ESTA_SEMANA,
      hoy: HOY,
      resumen: {
        presentes: { cantidad: 0, porcentaje: 0 },
        ausentes: { cantidad: 0, porcentaje: 0 },
        sinRegistrar: { cantidad: 0, porcentaje: 0 },
        profesoresSinRegistrar: 0,
      },
      profesores: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      materias: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
    })
  })

  it('arma el resumen y las tablas; los profesores sin turnos no cancelados no aparecen', async () => {
    cargarEjemplo()

    const { resumen, profesores, materias } = await service.obtenerAsistencia(PRIMERA_PAGINA)

    expect(resumen).toEqual({
      presentes: { cantidad: 1, porcentaje: 33.3 },
      ausentes: { cantidad: 0, porcentaje: 0 },
      sinRegistrar: { cantidad: 2, porcentaje: 66.7 },
      // Ana tiene un turno todavía dentro del plazo; Luis sólo cerrados.
      profesoresSinRegistrar: 1,
    })
    // Por defecto, los de más cerrados sin registrar primero.
    expect(profesores.data.map((f) => [f.profesor.nombre, f.cerradosSinRegistrar])).toEqual([
      ['Luis', 2],
      ['Ana', 0],
    ])
    expect(profesores.data[0]).toEqual({
      profesor: { id: 7, nombre: 'Luis', apellido: 'Pérez' },
      asistenciasRegistradas: 0,
      porcentajeRegistrado: 0,
      cerradosSinRegistrar: 2,
      porcentajeSinRegistrar: 100,
      noRegistraAsistencia: true,
    })
    expect(profesores.data[1]).toMatchObject({
      asistenciasRegistradas: 1,
      porcentajeRegistrado: 100,
      porcentajeSinRegistrar: 0,
      noRegistraAsistencia: false,
    })
    expect(materias.data.map((f) => f.materia.nombre)).toEqual(['Física', 'Matemática'])
    expect(Object.keys(materias.data[0] ?? {})).not.toContain('noRegistraAsistencia')
  })

  it('`profesoresSinRegistrar` es el de la ventana que termina hoy, no el del período pedido', async () => {
    // El período pedido (de hace dos semanas) sólo tiene cerrados; en la ventana de hoy, un pendiente.
    const PERIODO_VIEJO = { desde: '2026-09-07', hasta: '2026-09-13' }
    repository.ocurrenciasDelPeriodo.mockImplementation(async (periodo) =>
      periodo.desde === PERIODO_VIEJO.desde
        ? [ocurrencia('2026-09-08', 'SIN_REGISTRAR', { profesorId: 7, vencido: true })]
        : [
            ocurrencia('2026-09-30', 'SIN_REGISTRAR', { profesorId: 3, vencido: false }),
            ocurrencia('2026-10-01', 'SIN_REGISTRAR', { profesorId: 5, vencido: false }),
          ],
    )

    const { resumen } = await service.obtenerAsistencia({ ...PRIMERA_PAGINA, ...PERIODO_VIEJO })

    expect(resumen.sinRegistrar.cantidad).toBe(1)
    expect(resumen.profesoresSinRegistrar).toBe(2)
  })

  it('`orden` y `direccion` reordenan sólo la tabla de profesores', async () => {
    cargarEjemplo()

    const { profesores, materias } = await service.obtenerAsistencia({
      ...PRIMERA_PAGINA,
      orden: 'profesor',
      direccion: 'asc',
    })

    expect(profesores.data.map((f) => f.profesor.apellido)).toEqual(['Gómez', 'Pérez'])
    // La de materias sigue en su orden fijo.
    expect(materias.data.map((f) => f.materia.nombre)).toEqual(['Física', 'Matemática'])
  })

  it('`soloSinRegistrar: true` deja sólo a los que no registran y no toca el resumen ni las materias', async () => {
    cargarEjemplo()

    const completo = await service.obtenerAsistencia(PRIMERA_PAGINA)
    const filtrado = await service.obtenerAsistencia({
      ...PRIMERA_PAGINA,
      soloSinRegistrar: 'true',
    })

    expect(filtrado.profesores.data.map((f) => f.profesor.nombre)).toEqual(['Luis'])
    expect(filtrado.profesores.meta.total).toBe(1)
    expect(filtrado.resumen).toEqual(completo.resumen)
    expect(filtrado.materias).toEqual(completo.materias)
  })

  it('`soloSinRegistrar: false` no filtra', async () => {
    cargarEjemplo()

    const { profesores } = await service.obtenerAsistencia({
      ...PRIMERA_PAGINA,
      soloSinRegistrar: 'false',
    })

    expect(profesores.data).toHaveLength(2)
  })

  it('pagina de a 10, cada tabla con su página, y una página de más viene vacía con su meta', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) =>
        ocurrencia('2026-09-28', 'REALIZADO', { profesorId: 100 + i, materiaId: 200 + i }),
      ),
    )

    const primera = await service.obtenerAsistencia(PRIMERA_PAGINA)
    const tercera = await service.obtenerAsistencia({
      ...PRIMERA_PAGINA,
      paginaProfesores: 3,
      paginaMaterias: 2,
    })
    const cuarta = await service.obtenerAsistencia({ ...PRIMERA_PAGINA, paginaProfesores: 4 })

    expect(primera.profesores.data).toHaveLength(10)
    expect(primera.profesores.meta).toEqual({ page: 1, pageSize: 10, total: 25, totalPages: 3 })
    expect(tercera.profesores.data).toHaveLength(5)
    expect(tercera.profesores.meta.page).toBe(3)
    expect(tercera.materias.data).toHaveLength(10)
    expect(tercera.materias.meta).toEqual({ page: 2, pageSize: 10, total: 25, totalPages: 3 })
    expect(cuarta.profesores.data).toEqual([])
    expect(cuarta.profesores.meta).toEqual({ page: 4, pageSize: 10, total: 25, totalPages: 3 })
  })

  it('las páginas siguen el orden pedido sin repetir ni saltear a nadie (empates incluidos)', async () => {
    // 15 profesores con los mismos números: el desempate por apellido, nombre e id es estable.
    repository.ocurrenciasDelPeriodo.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) =>
        ocurrencia('2026-09-28', 'REALIZADO', { profesorId: 100 + i }),
      ),
    )

    const [uno, dos] = await Promise.all([
      service.obtenerAsistencia(PRIMERA_PAGINA),
      service.obtenerAsistencia({ ...PRIMERA_PAGINA, paginaProfesores: 2 }),
    ])

    const ids = [...uno.profesores.data, ...dos.profesores.data].map((f) => f.profesor.id)
    expect(new Set(ids).size).toBe(15)
  })

  it('"hoy" es el de Salta y viaja en la respuesta', async () => {
    const service = crearTableroService({
      repository,
      reloj: () => new Date('2026-10-03T02:00:00Z'),
    })

    expect((await service.obtenerAsistencia(PRIMERA_PAGINA)).hoy).toBe(HOY)
  })

  it('nunca trae a un alumno ni el campo interno `busqueda`', async () => {
    cargarEjemplo()

    const json = JSON.stringify(await service.obtenerAsistencia(PRIMERA_PAGINA))

    expect(json).not.toContain('Alumno')
    expect(json).not.toContain('alumnoId')
    expect(json).not.toContain('"alumno"')
    expect(json).not.toContain('busqueda')
  })
})

describe('asistencia: tablas completas para el PDF', () => {
  it('trae todas las filas, sin páginas ni filtro, en el orden por defecto', async () => {
    repository.ocurrenciasDelPeriodo.mockResolvedValue([
      ...Array.from({ length: 25 }, (_, i) =>
        ocurrencia('2026-09-28', 'REALIZADO', { profesorId: 100 + i, materiaId: 200 + i }),
      ),
      ocurrencia('2026-09-22', 'SIN_REGISTRAR', { profesorId: 7, vencido: true }),
    ])

    const { periodo, hoy, resumen, profesores, materias } =
      await service.asistenciaCompleta(ESTA_SEMANA)

    expect(periodo).toEqual(ESTA_SEMANA)
    expect(hoy).toBe(HOY)
    expect(resumen.sinRegistrar.cantidad).toBe(1)
    expect(profesores).toHaveLength(26)
    expect(profesores[0]?.profesor.id).toBe(7)
    expect(materias).toHaveLength(26)
    expect(repository.ocurrenciasDelPeriodo).toHaveBeenCalledTimes(2)
    expect(repository.ocurrenciasDelPeriodo).toHaveBeenNthCalledWith(1, ESTA_SEMANA, reloj)
  })
})
