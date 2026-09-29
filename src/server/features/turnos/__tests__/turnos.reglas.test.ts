import { describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  analizarHora,
  estadoDeOcurrencia,
  fechasDeLaSerie,
  finEfectivo,
  horizonte,
  ocupacionMaxima,
  ocupaLugarEn,
  planificarReserva,
  primeraFechaLibre,
  type PedidoReserva,
} from '../turnos.reglas'
import type { SerieFechas, SnapshotReserva, TurnoFechas } from '../turnos.validation'

// Reglas puras: sin base, sin reloj. Todas las fechas de 2026-09-28 en adelante con paso de 7 días
// son lunes (28/09, 05/10, 12/10, 19/10, 26/10, 02/11 … 30/11).

// Una serie sin finalización ni cancelaciones (los datos del Sprint 1): fin efectivo = fechaFin.
const turno = (
  fechaInicio: string,
  fechaFin: string | null,
  estado: TurnoFechas['estado'] = 'ACTIVO',
): SerieFechas => ({ estado, fechaInicio, finEfectivo: fechaFin, canceladas: [] })
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
    observaciones: null,
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
          observaciones: null,
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

// ---------------------------------------------------------------------------------------------
// Series y ocurrencias (T-30): fin efectivo, canceladas, estado y horizonte
// ---------------------------------------------------------------------------------------------

const conCanceladas = (serie: SerieFechas, ...canceladas: string[]): SerieFechas => ({
  ...serie,
  canceladas,
})

describe('finEfectivo', () => {
  it('sin finalización: la fechaFin guardada (null = sin fin)', () => {
    expect(finEfectivo({ fechaFin: '2026-11-30' })).toBe('2026-11-30')
    expect(finEfectivo({ fechaFin: null }, null)).toBeNull()
  })

  it('finalización con fechaFin nula: el día anterior a fechaDesde', () => {
    expect(finEfectivo({ fechaFin: null }, { fechaDesde: '2026-10-19' })).toBe('2026-10-18')
  })

  it('fechaFin anterior a fechaDesde: manda fechaFin', () => {
    expect(finEfectivo({ fechaFin: '2026-10-12' }, { fechaDesde: '2026-10-26' })).toBe('2026-10-12')
  })

  it('finalización antes de fechaFin: la corta', () => {
    expect(finEfectivo({ fechaFin: '2026-11-30' }, { fechaDesde: '2026-10-19' })).toBe('2026-10-18')
  })
})

describe('fechasDeLaSerie', () => {
  it('cada 7 días desde fechaInicio, dentro del rango y hasta el fin efectivo', () => {
    expect(
      fechasDeLaSerie(
        { fechaInicio: '2026-09-28', finEfectivo: '2026-10-18' },
        '2026-09-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })

  it('un rango que empieza en el medio de la serie arranca en su primera fecha alineada', () => {
    expect(
      fechasDeLaSerie({ fechaInicio: '2026-09-28', finEfectivo: null }, '2026-10-07', '2026-10-20'),
    ).toEqual(['2026-10-12', '2026-10-19'])
  })

  it('una sesión única: sólo su fecha, si cae en el rango', () => {
    const unica = { fechaInicio: '2026-10-05', finEfectivo: '2026-10-05' }
    expect(fechasDeLaSerie(unica, '2026-10-01', '2026-10-31')).toEqual(['2026-10-05'])
    expect(fechasDeLaSerie(unica, '2026-10-06', '2026-10-31')).toEqual([])
  })

  it('una serie sin fin queda acotada por `hasta`', () => {
    expect(
      fechasDeLaSerie({ fechaInicio: '2026-09-28', finEfectivo: null }, '2026-09-28', '2026-10-04'),
    ).toEqual(['2026-09-28'])
  })
})

describe('ocupaLugarEn con fin efectivo y canceladas', () => {
  it('una fecha cancelada no ocupa lugar; las demás de la serie sí', () => {
    const serie = conCanceladas(turno('2026-10-05', null), '2026-10-12')
    expect(ocupaLugarEn(serie, '2026-10-05')).toBe(true)
    expect(ocupaLugarEn(serie, '2026-10-12')).toBe(false)
    expect(ocupaLugarEn(serie, '2026-10-19')).toBe(true)
  })

  it('después del fin efectivo no ocupa lugar', () => {
    const finalizada = turno(
      '2026-10-05',
      finEfectivo({ fechaFin: null }, { fechaDesde: '2026-10-19' }),
    )
    expect(ocupaLugarEn(finalizada, '2026-10-12')).toBe(true)
    expect(ocupaLugarEn(finalizada, '2026-10-19')).toBe(false)
  })
})

describe('estadoDeOcurrencia', () => {
  const hoy = '2026-09-29'

  it('cancelada → CANCELADO, aunque sea pasada', () => {
    expect(estadoDeOcurrencia('2026-09-28', true, hoy)).toBe('CANCELADO')
  })

  it('anterior a hoy → SIN_REGISTRAR; hoy o posterior → AGENDADO', () => {
    expect(estadoDeOcurrencia('2026-09-28', false, hoy)).toBe('SIN_REGISTRAR')
    expect(estadoDeOcurrencia(hoy, false, hoy)).toBe('AGENDADO')
    expect(estadoDeOcurrencia('2026-10-05', false, hoy)).toBe('AGENDADO')
  })
})

describe('primeraFechaLibre (vigente y superposición)', () => {
  it('saltea las canceladas', () => {
    const serie = conCanceladas(turno('2026-10-05', null), '2026-10-05', '2026-10-12')
    expect(primeraFechaLibre(serie, '2026-10-05', null)).toBe('2026-10-19')
  })

  it('una serie sin fin siempre tiene una (vigente)', () => {
    const serie = conCanceladas(turno('2026-09-28', null), '2026-10-05', '2026-10-12', '2026-10-19')
    expect(primeraFechaLibre(serie, '2026-10-01', null)).toBe('2026-10-26')
  })

  it('con todas las fechas restantes canceladas o fuera del fin efectivo: null (no vigente)', () => {
    const todasCanceladas = conCanceladas(
      turno('2026-10-05', '2026-10-19'),
      '2026-10-12',
      '2026-10-19',
    )
    expect(primeraFechaLibre(todasCanceladas, '2026-10-06', null)).toBeNull()
    const finalizada = turno(
      '2026-09-07',
      finEfectivo({ fechaFin: null }, { fechaDesde: '2026-10-05' }),
    )
    expect(primeraFechaLibre(finalizada, '2026-09-30', null)).toBeNull()
  })

  it('acotada por `hasta` y por el fin efectivo', () => {
    const serie = conCanceladas(turno('2026-10-05', null), '2026-10-05')
    expect(primeraFechaLibre(serie, '2026-10-05', '2026-10-05')).toBeNull()
    expect(primeraFechaLibre(serie, '2026-10-05', '2026-10-12')).toBe('2026-10-12')
  })

  it('un turno CANCELADO (anterior al Sprint 2) no tiene ninguna', () => {
    expect(primeraFechaLibre(turno('2026-10-05', null, 'CANCELADO'), '2026-10-05', null)).toBeNull()
  })

  it('un fin lejano (año 2100) no se recorre: itera sólo por las canceladas', () => {
    const serie = conCanceladas(turno('2026-10-05', '2100-12-27'), '2026-10-05')
    expect(primeraFechaLibre(serie, '2026-10-05', null)).toBe('2026-10-12')
  })
})

describe('horizonte', () => {
  it('la mayor fecha finita entre el inicio, las fechaInicio y los fines efectivos', () => {
    expect(
      horizonte([turno('2026-10-12', null), turno('2026-10-05', '2026-11-02')], '2026-10-05'),
    ).toBe('2026-11-02')
    expect(horizonte([], '2026-10-05')).toBe('2026-10-05')
  })

  it('una cancelación posterior a todo lo demás mueve el horizonte', () => {
    const series = [conCanceladas(turno('2026-10-05', null), '2026-12-28')]
    expect(horizonte(series, '2026-10-05')).toBe('2026-12-28')
  })
})

describe('ocupación con canceladas y fin efectivo (T-30)', () => {
  it('analizarHora: una ocurrencia cancelada libera su fecha', () => {
    const a = analizarHora({
      inicio: '2026-10-05',
      fin: '2026-10-05',
      capacidad: 1,
      existentes: [conCanceladas(turno('2026-09-28', null), '2026-10-05')],
    })
    expect(a.sinLugar).toBe(false)
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-05', fechaFin: '2026-10-05' }])
  })

  it('analizarHora: un recurrente finalizado antes de la fecha no la ocupa', () => {
    const finalizado = turno(
      '2026-09-28',
      finEfectivo({ fechaFin: null }, { fechaDesde: '2026-10-05' }),
    )
    expect(
      analizarHora({ inicio: '2026-10-05', fin: null, capacidad: 1, existentes: [finalizado] }),
    ).toEqual({
      fechasLlenas: [],
      completoDesde: null,
      tramos: [{ fechaInicio: '2026-10-05', fechaFin: null }],
      sinLugar: false,
    })
  })

  it('analizarHora: una cancelación posterior a todo lo demás se evalúa (mueve el horizonte)', () => {
    // Serie sin fin que llena la hora, con el 26/10 cancelado: esa fecha queda con lugar y la cola
    // (después del 26/10) sigue llena.
    const a = analizarHora({
      inicio: '2026-10-05',
      fin: null,
      capacidad: 1,
      existentes: [conCanceladas(turno('2026-09-28', null), '2026-10-26')],
    })
    expect(a.fechasLlenas).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(a.completoDesde).toBe('2026-11-02')
    expect(a.tramos).toEqual([{ fechaInicio: '2026-10-26', fechaFin: '2026-10-26' }])
  })

  it('ocupacionMaxima: una fecha cancelada no suma y la semana siguiente vuelve a contar', () => {
    const series = [
      conCanceladas(turno('2026-10-05', null), '2026-10-05'),
      turno('2026-10-05', '2026-10-05'),
    ]
    expect(ocupacionMaxima(series, '2026-10-05')).toEqual({ fecha: '2026-10-05', cantidad: 1 })
    expect(
      ocupacionMaxima([conCanceladas(turno('2026-10-05', null), '2026-10-05')], '2026-10-05'),
    ).toEqual({ fecha: '2026-10-12', cantidad: 1 })
  })

  it('ocupacionMaxima: una serie finalizada deja de contar desde su fin efectivo', () => {
    const finalizada = turno(
      '2026-09-28',
      finEfectivo({ fechaFin: null }, { fechaDesde: '2026-10-12' }),
    )
    expect(ocupacionMaxima([finalizada], '2026-10-12')).toBeNull()
  })
})

describe('planificarReserva: superposición del alumno', () => {
  const pedido: PedidoReserva = {
    alumnoId: 12,
    materiaId: 3,
    profesorId: 4,
    diaSemana: 1,
    bloqueIds: [10, 12],
    tipo: 'SESION_UNICA',
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-05',
    observaciones: null,
    asignarDondeHayLugar: false,
  }
  const fila = (id: number, horaInicio: number) => ({
    id,
    estado: 'ACTIVO' as const,
    profesorId: 4,
    diaSemana: 1,
    horaInicio,
    horaFin: horaInicio + 60,
    aulaCapacidad: 6,
  })
  const base: SnapshotReserva = {
    filas: [fila(10, 480), fila(12, 600)],
    profesor: { id: 4, capacidad: 6, estado: 'ACTIVO' },
    materia: { id: 3, estado: 'ACTIVO' },
    asignacion: { estado: 'ACTIVO' },
    ocupantes: [],
    turnosAlumno: [],
  }
  const delAlumno = (horaInicio: number) => ({
    id: 70,
    tipo: 'SESION_UNICA' as const,
    estado: 'ACTIVO' as const,
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-05',
    diaSemana: 1,
    horaInicio,
    horaFin: horaInicio + 60,
    profesor: { id: 7, nombre: 'Juan', apellido: 'Ruiz' },
    materia: { id: 3, nombre: 'Matemática' },
  })

  it('horas pedidas no contiguas (8–9 y 10–11): un turno del alumno de 9–10 no choca', () => {
    const plan = planificarReserva({ ...base, turnosAlumno: [delAlumno(540)] }, pedido)
    expect(plan.turnos).toHaveLength(2)
  })

  it('un turno del alumno en una hora pedida: 409 ALUMNO_SUPERPUESTO', () => {
    const error = errorDe(() =>
      planificarReserva({ ...base, turnosAlumno: [delAlumno(600)] }, pedido),
    )
    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).code).toBe('ALUMNO_SUPERPUESTO')
  })
})
