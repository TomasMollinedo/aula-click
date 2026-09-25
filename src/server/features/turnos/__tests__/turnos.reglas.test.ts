import { describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  analizarHora,
  expandirOcurrencias,
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_MAXIMO,
  ocupacionMaxima,
  ocupaLugarEn,
  planificarReserva,
  validarRangoAgenda,
  type PedidoReserva,
} from '../turnos.reglas'
import type { SnapshotReserva, TurnoFechas } from '../turnos.validation'

// Reglas puras: sin base, sin reloj. Todas las fechas de 2026-09-28 en adelante con paso de 7 días
// son lunes (28/09, 05/10, 12/10, 19/10, 26/10, 02/11 … 30/11).

const turno = (
  fechaInicio: string,
  fechaFin: string | null,
  estado: TurnoFechas['estado'] = 'ACTIVO',
): TurnoFechas => ({ estado, fechaInicio, fechaFin })
const sesion = (fecha: string) => turno(fecha, fecha)

/** Ejecuta `accion`, que debe lanzar, y devuelve el error. */
function errorDe(accion: () => unknown): unknown {
  try {
    accion()
  } catch (error) {
    return error
  }
  return expect.fail('Se esperaba un error')
}

describe('ocupaLugarEn', () => {
  it('sesión única: solo en su fecha', () => {
    expect(ocupaLugarEn(sesion('2026-10-05'), '2026-10-05')).toBe(true)
    expect(ocupaLugarEn(sesion('2026-10-05'), '2026-10-12')).toBe(false)
    expect(ocupaLugarEn(sesion('2026-10-05'), '2026-09-28')).toBe(false)
  })

  it('recurrente con fin: incluye el inicio y el fin, nada antes ni después', () => {
    const r = turno('2026-10-05', '2026-10-19')
    expect(ocupaLugarEn(r, '2026-09-28')).toBe(false)
    expect(ocupaLugarEn(r, '2026-10-05')).toBe(true)
    expect(ocupaLugarEn(r, '2026-10-12')).toBe(true)
    expect(ocupaLugarEn(r, '2026-10-19')).toBe(true)
    expect(ocupaLugarEn(r, '2026-10-26')).toBe(false)
  })

  it('recurrente sin fin (fechaFin null): desde su inicio en adelante', () => {
    const r = turno('2026-10-05', null)
    expect(ocupaLugarEn(r, '2026-09-28')).toBe(false)
    expect(ocupaLugarEn(r, '2026-10-05')).toBe(true)
    expect(ocupaLugarEn(r, '2100-12-27')).toBe(true)
  })

  it('un cancelado no ocupa lugar', () => {
    expect(ocupaLugarEn(turno('2026-10-05', null, 'CANCELADO'), '2026-10-05')).toBe(false)
  })
})

describe('ocupacionMaxima', () => {
  it('sin turnos, o sin ninguno que ocupe lugar desde la fecha: null', () => {
    expect(ocupacionMaxima([], '2026-10-05')).toBeNull()
    expect(ocupacionMaxima([sesion('2026-09-28')], '2026-10-05')).toBeNull()
  })

  it('dos tramos del mismo recurrente no suman: nunca coinciden en una fecha', () => {
    expect(
      ocupacionMaxima(
        [turno('2026-10-05', '2026-10-19'), turno('2026-11-02', '2026-11-30')],
        '2026-10-05',
      ),
    ).toEqual({ fecha: '2026-10-05', cantidad: 1 })
  })

  it('el máximo puede estar en el futuro, cuando empieza otro turno', () => {
    expect(
      ocupacionMaxima(
        [turno('2026-10-05', null), sesion('2026-10-26'), turno('2026-10-26', '2026-11-02')],
        '2026-10-05',
      ),
    ).toEqual({ fecha: '2026-10-26', cantidad: 3 })
  })

  it('un recurrente que empezó antes cuenta desde la fecha pedida; los cancelados no cuentan', () => {
    expect(
      ocupacionMaxima(
        [turno('2026-09-28', null), turno('2026-09-28', null, 'CANCELADO')],
        '2026-10-05',
      ),
    ).toEqual({ fecha: '2026-10-05', cantidad: 1 })
  })
})

describe('validarRangoAgenda', () => {
  it('acepta un solo día y un rango del máximo de días', () => {
    expect(() => validarRangoAgenda('2026-09-28', '2026-09-28')).not.toThrow()
    // 28/09 + 30 días = 28/10: 31 días contando los dos extremos.
    expect(() => validarRangoAgenda('2026-09-28', '2026-10-28')).not.toThrow()
  })

  it('`hasta` anterior a `desde`: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoAgenda('2026-09-28', '2026-09-27'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO },
    ])
  })

  it('rango mayor al máximo: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoAgenda('2026-09-28', '2026-10-29'))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_MAXIMO },
    ])
  })
})

describe('expandirOcurrencias', () => {
  // Lunes 28/09 a domingo 04/10 de 2026.
  const semana = { desde: '2026-09-28', hasta: '2026-10-04' }
  const conDia = (diaSemana: number, id: number, fechaInicio: string, fechaFin: string | null) => ({
    ...turno(fechaInicio, fechaFin),
    id,
    diaSemana,
  })

  it('una sesión única aparece solo en su fecha', () => {
    const sesionMartes = conDia(2, 1, '2026-09-29', '2026-09-29')
    expect(expandirOcurrencias([sesionMartes], semana.desde, semana.hasta)).toEqual([
      { fecha: '2026-09-29', turno: sesionMartes },
    ])
  })

  it('un recurrente sin fin aparece una vez por semana, en el día de su fila', () => {
    const lunes = conDia(1, 1, '2026-09-28', null)
    const enDosSemanas = expandirOcurrencias([lunes], '2026-09-28', '2026-10-11')
    expect(enDosSemanas.map((o) => o.fecha)).toEqual(['2026-09-28', '2026-10-05'])
  })

  it('no incluye las fechas fuera del rango del turno ni los cancelados', () => {
    const terminado = conDia(1, 1, '2026-09-21', '2026-09-21')
    const cancelado = { ...conDia(1, 2, '2026-09-28', null), estado: 'CANCELADO' as const }
    expect(expandirOcurrencias([terminado, cancelado], semana.desde, semana.hasta)).toEqual([])
  })

  it('ordena por fecha y conserva el orden de entrada dentro del día', () => {
    const nueve = conDia(1, 10, '2026-09-28', null)
    const diez = conDia(1, 11, '2026-09-28', null)
    const martes = conDia(2, 12, '2026-09-29', '2026-09-29')
    expect(
      expandirOcurrencias([nueve, diez, martes], semana.desde, semana.hasta).map((o) => [
        o.fecha,
        o.turno.id,
      ]),
    ).toEqual([
      ['2026-09-28', 10],
      ['2026-09-28', 11],
      ['2026-09-29', 12],
    ])
  })

  it('dice lo mismo que `ocupaLugarEn` en cada fecha del rango', () => {
    const turnos = [
      conDia(1, 1, '2026-09-28', null),
      conDia(3, 2, '2026-09-30', '2026-09-30'),
      conDia(5, 3, '2026-10-02', '2026-10-16'),
    ]
    const ocurrencias = expandirOcurrencias(turnos, semana.desde, semana.hasta)
    for (const { fecha, turno: encontrado } of ocurrencias) {
      expect(ocupaLugarEn(encontrado, fecha)).toBe(true)
    }
    expect(ocurrencias.map((o) => o.fecha)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02'])
  })
})

describe('analizarHora', () => {
  const base = { inicio: '2026-10-05', fin: '2026-11-30' as string | null }

  it('sin conflictos: un solo tramo igual al pedido', () => {
    expect(analizarHora({ ...base, capacidad: 2, existentes: [sesion('2026-10-26')] })).toEqual({
      fechasLlenas: [],
      completoDesde: null,
      tramos: [{ fechaInicio: '2026-10-05', fechaFin: '2026-11-30' }],
      sinLugar: false,
    })
  })

  it('una fecha llena en el medio: dos tramos que la saltean', () => {
    expect(analizarHora({ ...base, capacidad: 1, existentes: [sesion('2026-10-26')] })).toEqual({
      fechasLlenas: ['2026-10-26'],
      completoDesde: null,
      tramos: [
        { fechaInicio: '2026-10-05', fechaFin: '2026-10-19' },
        { fechaInicio: '2026-11-02', fechaFin: '2026-11-30' },
      ],
      sinLugar: false,
    })
  })

  it('llena al principio: el tramo arranca en la fecha siguiente', () => {
    const a = analizarHora({ ...base, capacidad: 1, existentes: [sesion('2026-10-05')] })
    expect(a.fechasLlenas).toEqual(['2026-10-05'])
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-12', fechaFin: '2026-11-30' }])
  })

  it('llena al final (fin = H, sin cola): va a fechasLlenas, no a completoDesde', () => {
    const a = analizarHora({ ...base, capacidad: 1, existentes: [sesion('2026-11-30')] })
    expect(a.fechasLlenas).toEqual(['2026-11-30'])
    expect(a.completoDesde).toBeNull()
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-05', fechaFin: '2026-11-23' }])
  })

  it('fin <= H (un existente termina después del pedido): no hay cola y todas las llenas se listan', () => {
    const a = analizarHora({
      ...base,
      capacidad: 1,
      existentes: [turno('2026-10-19', '2027-01-04')],
    })
    expect(a.completoDesde).toBeNull()
    expect(a.fechasLlenas).toEqual([
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ])
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-05', fechaFin: '2026-10-12' }])
  })

  it('fin finito con la cola llena: completoDesde (incluye las últimas evaluadas llenas)', () => {
    const a = analizarHora({ ...base, capacidad: 1, existentes: [turno('2026-10-19', null)] })
    expect(a).toEqual({
      fechasLlenas: [],
      completoDesde: '2026-10-19',
      tramos: [{ fechaInicio: '2026-10-05', fechaFin: '2026-10-12' }],
      sinLugar: false,
    })
  })

  it('recurrente sin fin con una sesión única llena en el medio: dos tramos, el último abierto', () => {
    expect(
      analizarHora({
        inicio: '2026-10-05',
        fin: null,
        capacidad: 1,
        existentes: [sesion('2026-10-26')],
      }),
    ).toEqual({
      fechasLlenas: ['2026-10-26'],
      completoDesde: null,
      tramos: [
        { fechaInicio: '2026-10-05', fechaFin: '2026-10-19' },
        { fechaInicio: '2026-11-02', fechaFin: null },
      ],
      sinLugar: false,
    })
  })

  it('recurrente sin fin, llena "para siempre" por recurrentes sin fin: completoDesde y último tramo cerrado', () => {
    expect(
      analizarHora({
        inicio: '2026-10-05',
        fin: null,
        capacidad: 2,
        existentes: [turno('2026-10-19', null), turno('2026-11-02', null), sesion('2026-10-12')],
      }),
    ).toEqual({
      fechasLlenas: [],
      completoDesde: '2026-11-02',
      tramos: [{ fechaInicio: '2026-10-05', fechaFin: '2026-10-26' }],
      sinLugar: false,
    })
  })

  it('sin fin, llena desde una fecha, con una llena antes: la anterior va a fechasLlenas', () => {
    const a = analizarHora({
      inicio: '2026-10-05',
      fin: null,
      capacidad: 1,
      existentes: [sesion('2026-10-12'), turno('2026-11-02', null)],
    })
    expect(a.fechasLlenas).toEqual(['2026-10-12'])
    expect(a.completoDesde).toBe('2026-11-02')
    expect(a.tramos).toEqual([
      { fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
      { fechaInicio: '2026-10-19', fechaFin: '2026-10-26' },
    ])
  })

  it('sin lugar en ninguna fecha', () => {
    expect(
      analizarHora({
        inicio: '2026-10-05',
        fin: null,
        capacidad: 1,
        existentes: [turno('2026-09-28', null)],
      }),
    ).toEqual({ fechasLlenas: [], completoDesde: '2026-10-05', tramos: [], sinLugar: true })
  })

  it('sesión única llena → sinLugar; con lugar → un tramo de una fecha', () => {
    const unica = { inicio: '2026-10-05', fin: '2026-10-05', capacidad: 1 }
    expect(analizarHora({ ...unica, existentes: [turno('2026-09-28', null)] })).toEqual({
      fechasLlenas: ['2026-10-05'],
      completoDesde: null,
      tramos: [],
      sinLugar: true,
    })
    expect(analizarHora({ ...unica, existentes: [] }).tramos).toEqual([
      { fechaInicio: '2026-10-05', fechaFin: '2026-10-05' },
    ])
  })

  it('capacidad exacta: llena si ocupación >= capacidad', () => {
    const existentes = [sesion('2026-10-05'), turno('2026-10-05', '2026-10-12')]
    const unica = { inicio: '2026-10-05', fin: '2026-10-05' }
    expect(analizarHora({ ...unica, capacidad: 2, existentes }).sinLugar).toBe(true)
    expect(analizarHora({ ...unica, capacidad: 3, existentes }).sinLugar).toBe(false)
  })

  it('un cancelado no ocupa lugar', () => {
    const a = analizarHora({
      ...base,
      capacidad: 1,
      existentes: [turno('2026-10-05', null, 'CANCELADO')],
    })
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-05', fechaFin: '2026-11-30' }])
  })

  it('cruce de mes y de año', () => {
    expect(
      analizarHora({
        inicio: '2026-12-21',
        fin: '2027-01-11',
        capacidad: 1,
        existentes: [sesion('2026-12-28')],
      }).tramos,
    ).toEqual([
      { fechaInicio: '2026-12-21', fechaFin: '2026-12-21' },
      { fechaInicio: '2027-01-04', fechaFin: '2027-01-11' },
    ])
  })

  it('un fin lejano (año 2100) no itera hasta el final', () => {
    const existentes = [sesion('2026-10-26')]
    const filtrar = vi.spyOn(existentes, 'filter')

    const a = analizarHora({ inicio: '2026-10-05', fin: '2100-12-27', capacidad: 1, existentes })

    expect(a.tramos).toEqual([
      { fechaInicio: '2026-10-05', fechaFin: '2026-10-19' },
      { fechaInicio: '2026-11-02', fechaFin: '2100-12-27' },
    ])
    // 4 fechas evaluadas (05/10 a 26/10) + la cola: no ~3900 semanas.
    expect(filtrar.mock.calls.length).toBeLessThan(10)
  })
})

describe('planificarReserva', () => {
  const pedido: PedidoReserva = {
    alumnoId: 12,
    materiaId: 3,
    profesorId: 4,
    diaSemana: 1,
    bloqueIds: [10],
    tipo: 'RECURRENTE',
    fechaInicio: '2026-10-05',
    fechaFin: '2026-11-30',
    motivoConsulta: null,
    asignarDondeHayLugar: false,
  }
  const snapshot: SnapshotReserva = {
    filas: [
      {
        id: 10,
        estado: 'ACTIVO',
        profesorId: 4,
        diaSemana: 1,
        horaInicio: 540,
        horaFin: 600,
        aulaCapacidad: 1,
      },
    ],
    profesor: { id: 4, capacidad: 6, estado: 'ACTIVO' },
    materia: { id: 3, estado: 'ACTIVO' },
    asignacion: { estado: 'ACTIVO' },
    ocupantes: [],
    turnosAlumno: [],
  }

  it('sin conflictos: un turno por hora con todo el pedido', () => {
    expect(planificarReserva(snapshot, pedido)).toEqual({
      turnos: [
        {
          bloqueAgendaId: 10,
          alumnoId: 12,
          materiaId: 3,
          tipo: 'RECURRENTE',
          estado: 'ACTIVO',
          fechaInicio: '2026-10-05',
          fechaFin: '2026-11-30',
          motivoConsulta: null,
        },
      ],
      fechasSinTurno: [],
    })
  })

  it('la fila cambió de día bajo lock: 400 en la fecha', () => {
    const filas = [{ ...snapshot.filas[0]!, diaSemana: 2 }]
    const error = errorDe(() => planificarReserva({ ...snapshot, filas }, pedido))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).message).toBe('La fecha debe caer en martes')
  })

  it('filas de otro profesor que el del pedido: 400 en bloqueIds', () => {
    const filas = [{ ...snapshot.filas[0]!, profesorId: 7 }]
    const error = errorDe(() => planificarReserva({ ...snapshot, filas }, pedido))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' },
    ])
  })

  it('la fila fue dada de baja bajo lock: 404', () => {
    const filas = [{ ...snapshot.filas[0]!, estado: 'INACTIVO' as const }]
    expect(errorDe(() => planificarReserva({ ...snapshot, filas }, pedido))).toBeInstanceOf(
      NotFoundError,
    )
  })

  it('profesor, materia o asignación dados de baja bajo lock: 409 con su código', () => {
    const casos: [Partial<SnapshotReserva>, string][] = [
      [{ profesor: { id: 4, capacidad: 6, estado: 'INACTIVO' } }, 'PROFESOR_INACTIVO'],
      [{ materia: { id: 3, estado: 'INACTIVO' } }, 'MATERIA_INACTIVA'],
      [{ asignacion: { estado: 'INACTIVO' } }, 'MATERIA_NO_ASIGNADA'],
      [{ asignacion: null }, 'MATERIA_NO_ASIGNADA'],
    ]
    for (const [cambio, code] of casos) {
      const error = errorDe(() => planificarReserva({ ...snapshot, ...cambio }, pedido))
      expect(error).toBeInstanceOf(ConflictError)
      expect((error as ConflictError).code).toBe(code)
    }
  })

  it('BLOQUE_LLENO: mensaje por hora como en la HU, con varias fechas y con completoDesde', () => {
    const conOcupantes = (ocupantes: SnapshotReserva['ocupantes']) =>
      errorDe(() => planificarReserva({ ...snapshot, ocupantes }, pedido)) as ConflictError

    const una = conOcupantes([{ bloqueAgendaId: 10, ...sesion('2026-10-26') }])
    expect(una.code).toBe('BLOQUE_LLENO')
    expect(una.details).toEqual([
      expect.objectContaining({
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
      }),
    ])

    const varias = conOcupantes([
      { bloqueAgendaId: 10, ...sesion('2026-10-12') },
      { bloqueAgendaId: 10, ...sesion('2026-10-26') },
      { bloqueAgendaId: 10, ...turno('2026-11-23', null) },
    ])
    expect((varias.details as { message: string }[])[0]?.message).toBe(
      'La hora de 9:00 a 10:00 está completa los lunes 12/10 y 26/10, y desde el lunes 23/11',
    )
  })
})
