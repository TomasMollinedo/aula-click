import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crearTurnosEnMemoria,
  d,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from '@/server/features/turnos/__tests__/turnos-en-memoria'
import {
  deudaVencida,
  leerAdeudados,
  leerProximos,
  totalAdeudado,
  type ClienteOcurrencias,
} from '../cuentas.condiciones'
import { totalDe } from '../cuentas.reglas'

// Condiciones de la deuda (T-53). Excepcional, a nivel de consulta (como el motor de T-30): el
// cliente es un falso que aplica el `where` sobre la tabla en memoria de `turnos-en-memoria.ts`,
// así se prueban juntos el motor real, las reglas de `cuentas.reglas.ts` y el rango "desde". El
// `aggregate` y los precios son falsos del mismo estilo.
//
// Hoy: lunes 05/10/2026. Ayer: domingo 04/10. Hoy + 56 = lunes 30/11; hoy + 57 = martes 01/12.
// Hoy - 30 = sábado 05/09 (deuda vencida); hoy - 29 = domingo 06/09.

const HOY = '2026-10-05'

const BLOQUES: BloqueDePrueba[] = [
  { id: 10, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 540 }, // lunes 9–10
  { id: 30, profesorId: 4, aulaId: 1, diaSemana: 7, horaInicio: 540 }, // domingo 9–10
  { id: 40, profesorId: 7, aulaId: 2, diaSemana: 2, horaInicio: 600 }, // martes 10–11
  { id: 60, profesorId: 4, aulaId: 1, diaSemana: 6, horaInicio: 540 }, // sábado 9–10
]

type WhereAggregate = {
  estado: string
  fechaInicio: { lte: Date }
  alumnoId?: number
  materiaId?: { in: number[] }
  bloqueAgenda?: { profesorId: number }
}

const profesorDe = (turno: TurnoDePrueba) =>
  BLOQUES.find((b) => b.id === turno.bloqueAgendaId)?.profesorId

let turnos: TurnoDePrueba[]
let precios: Map<number, number | null>
let base: ReturnType<typeof crearTurnosEnMemoria>
let aggregate: ReturnType<typeof vi.fn>
let materiaFindMany: ReturnType<typeof vi.fn>

function cliente(): ClienteOcurrencias {
  base = crearTurnosEnMemoria(BLOQUES, turnos)
  aggregate = vi.fn(async ({ where }: { where: WhereAggregate }) => {
    const inicios = turnos
      .filter(
        (t) =>
          (t.estado ?? 'ACTIVO') === where.estado &&
          d(t.fechaInicio) <= where.fechaInicio.lte &&
          (where.alumnoId === undefined || (t.alumnoId ?? 12) === where.alumnoId) &&
          (where.materiaId === undefined || where.materiaId.in.includes(t.materiaId ?? 3)) &&
          (where.bloqueAgenda === undefined || profesorDe(t) === where.bloqueAgenda.profesorId),
      )
      .map((t) => d(t.fechaInicio).getTime())
    return { _min: { fechaInicio: inicios.length === 0 ? null : new Date(Math.min(...inicios)) } }
  })
  materiaFindMany = vi.fn(async ({ where }: { where: { id: { in: number[] } } }) =>
    where.id.in
      .filter((id) => precios.has(id))
      .map((id) => {
        const precio = precios.get(id) ?? null
        return { id, precioHora: precio === null ? null : { toNumber: () => precio } }
      }),
  )
  return {
    turno: { findMany: base.findMany, aggregate },
    materia: { findMany: materiaFindMany },
  } as unknown as ClienteOcurrencias
}

beforeEach(() => {
  turnos = []
  precios = new Map([
    [3, 8000],
    [5, 9000],
  ])
})

const claves = (items: { ocurrencia: { turnoId: number; fecha: string } }[]) =>
  items.map(({ ocurrencia }) => [ocurrencia.turnoId, ocurrencia.fecha])

/** El rango de fechas que `leerOcurrencias` le pidió al motor en su primera consulta. */
const rangoLeido = () => base.findMany.mock.calls[0]?.[0].select.cancelaciones.where.fechaOcurrencia

describe('leerAdeudados', () => {
  it('pasado impago adeuda con el importe vigente; cancelado, pagado y hoy no', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-14',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-09-21' }],
        pagos: [{ fecha: '2026-09-28', pagoId: 9, importe: 8000 }],
      },
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    // 14/09 adeuda; 21/09 cancelado; 28/09 pagado; 05/10 es hoy (próximo).
    expect(claves(adeudados)).toEqual([[1, '2026-09-14']])
    expect(adeudados[0]?.importe).toBe(8000)
    expect(adeudados[0]?.ocurrencia.estado).toBe('SIN_REGISTRAR')
  })

  it('reloj de mediodía: la ocurrencia de ayer adeuda y la de hoy no', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 30, fechaInicio: '2026-10-04', fechaFin: '2026-10-04' }, // ayer
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' }, // hoy
    ]

    expect(claves(await leerAdeudados(cliente(), { hoy: HOY }))).toEqual([[1, '2026-10-04']])
  })

  it('sin período, "desde" es la fechaInicio más antigua de los turnos ACTIVO que empezaron antes de hoy; "hasta" es ayer', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, fechaInicio: '2026-08-04', fechaFin: '2026-08-11' },
      { id: 3, bloqueAgendaId: 10, fechaInicio: '2026-07-06', fechaFin: null, estado: 'CANCELADO' },
      { id: 4, bloqueAgendaId: 10, fechaInicio: '2026-10-12', fechaFin: null }, // futuro
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    expect(aggregate).toHaveBeenCalledWith({
      where: { estado: 'ACTIVO', fechaInicio: { lte: d('2026-10-04') } },
      _min: { fechaInicio: true },
    })
    expect(rangoLeido()).toEqual({ gte: d('2026-08-04'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([
      [2, '2026-08-04'],
      [2, '2026-08-11'],
      [1, '2026-09-28'],
    ])
  })

  it('sin período, `fechaInicio <= ayer` da lo mismo que `< hoy`: el turno que empezó ayer cuenta y el que empieza hoy no', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 30, fechaInicio: '2026-10-04', fechaFin: null }, // domingo, ayer
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: null }, // lunes, hoy
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    // El `aggregate` elige los mismos turnos que con `fechaInicio < hoy`: sólo el de ayer.
    const empezaronAntesDeHoy = turnos.filter((t) => d(t.fechaInicio) < d(HOY)).map((t) => t.id)
    const empezaronHastaAyer = turnos
      .filter((t) => d(t.fechaInicio) <= aggregate.mock.calls[0]?.[0].where.fechaInicio.lte)
      .map((t) => t.id)
    expect(empezaronHastaAyer).toEqual(empezaronAntesDeHoy)
    expect(rangoLeido()).toEqual({ gte: d('2026-10-04'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([[1, '2026-10-04']])

    // Con sólo el turno de hoy, no hay ninguno que haya empezado: no se lee nada.
    turnos = [{ id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: null }]
    expect(await leerAdeudados(cliente(), { hoy: HOY })).toEqual([])
    expect(base.findMany).not.toHaveBeenCalled()
  })

  it('con alumnoId filtra el rango y las ocurrencias por alumno', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, alumnoId: 12, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 10, alumnoId: 15, fechaInicio: '2026-08-03', fechaFin: null },
    ]

    const adeudados = await leerAdeudados(cliente(), { alumnoId: 12, hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.alumnoId).toBe(12)
    expect(base.findMany.mock.calls[0]?.[0].where.alumnoId).toBe(12)
    expect(claves(adeudados)).toEqual([[1, '2026-09-28']])
  })

  it('con una materia: la filtran el aggregate y el motor', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, materiaId: 3, fechaInicio: '2026-08-03', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, materiaId: 5, fechaInicio: '2026-09-22', fechaFin: null },
    ]

    const adeudados = await leerAdeudados(cliente(), { materiaIds: [5], hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.materiaId).toEqual({ in: [5] })
    expect(base.findMany.mock.calls[0]?.[0].where.materiaId).toEqual({ in: [5] })
    // El rango empieza en el primer turno de esa materia, no en el más antiguo de todos.
    expect(rangoLeido()).toEqual({ gte: d('2026-09-22'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([
      [2, '2026-09-22'],
      [2, '2026-09-29'],
    ])
    expect(adeudados.every((a) => a.importe === 9000)).toBe(true)
  })

  it('con profesorId: el aggregate usa la relación del motor (el profesor del bloque) y no deja nada afuera', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-08-03', fechaFin: null }, // profesor 4
      { id: 2, bloqueAgendaId: 40, fechaInicio: '2026-09-15', fechaFin: null }, // profesor 7
      { id: 3, bloqueAgendaId: 40, alumnoId: 15, fechaInicio: '2026-09-01', fechaFin: null }, // 7
    ]

    const todos = await leerAdeudados(cliente(), { hoy: HOY })
    const delProfesor = await leerAdeudados(cliente(), { profesorId: 7, hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.bloqueAgenda).toEqual({ profesorId: 7 })
    expect(base.findMany.mock.calls[0]?.[0].where.bloqueAgenda?.profesorId).toBe(7)
    expect(rangoLeido()).toEqual({ gte: d('2026-09-01'), lte: d('2026-10-04') })
    // Lo mismo que da el motor sin el filtro, quedándose con las de ese profesor.
    expect(claves(delProfesor)).toEqual(claves(todos.filter((a) => a.ocurrencia.profesorId === 7)))
    expect(delProfesor).toHaveLength(8) // martes 01/09 a 29/09 (5) + 15/09 a 29/09 (3)
  })

  it('con `desde`: no hace falta el aggregate y el rango es el del período hasta ayer', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-08-03', fechaFin: null }]

    const adeudados = await leerAdeudados(cliente(), {
      desde: '2026-09-21',
      hasta: '2026-10-19',
      hoy: HOY,
    })

    expect(aggregate).not.toHaveBeenCalled()
    expect(rangoLeido()).toEqual({ gte: d('2026-09-21'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([
      [1, '2026-09-21'],
      [1, '2026-09-28'],
    ])
  })

  it('con sólo `hasta` en el pasado: del primer turno hasta ese día', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-07', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, fechaInicio: '2026-09-22', fechaFin: null }, // empieza después
    ]

    const adeudados = await leerAdeudados(cliente(), { hasta: '2026-09-14', hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.fechaInicio).toEqual({ lte: d('2026-09-14') })
    expect(rangoLeido()).toEqual({ gte: d('2026-09-07'), lte: d('2026-09-14') })
    expect(claves(adeudados)).toEqual([
      [1, '2026-09-07'],
      [1, '2026-09-14'],
    ])
  })

  it('período sólo futuro (`desde` es hoy o posterior): [] sin consultar nada', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-08-03', fechaFin: null }]
    const client = cliente()
    const noviembre = { desde: '2026-11-01', hasta: '2026-11-30', hoy: HOY }

    expect(await leerAdeudados(client, { desde: HOY, hoy: HOY })).toEqual([])
    expect(await leerAdeudados(client, noviembre)).toEqual([])
    expect(await totalAdeudado(client, noviembre)).toBe(0)
    expect(aggregate).not.toHaveBeenCalled()
    expect(base.findMany).not.toHaveBeenCalled()
  })

  it('sin turnos que empezaron antes de hoy: [] sin leer ocurrencias ni precios', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-10-12', fechaFin: null }]

    expect(await leerAdeudados(cliente(), { hoy: HOY })).toEqual([])
    expect(base.findMany).not.toHaveBeenCalled()
    expect(materiaFindMany).not.toHaveBeenCalled()
  })

  it('cambio de precio: el mismo impago muestra el importe nuevo; sin precio → null', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        materiaId: 3,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
      },
      {
        id: 2,
        bloqueAgendaId: 40,
        materiaId: 5,
        fechaInicio: '2026-09-29',
        fechaFin: '2026-09-29',
      },
    ]

    const antes = await leerAdeudados(cliente(), { hoy: HOY })
    precios.set(3, 9500)
    precios.set(5, null)
    const despues = await leerAdeudados(cliente(), { hoy: HOY })

    expect(antes.map((a) => a.importe)).toEqual([8000, 9000])
    expect(despues.map((a) => a.importe)).toEqual([9500, null])
    expect(materiaFindMany).toHaveBeenCalledWith({
      where: { id: { in: [3, 5] } },
      select: { id: true, precioHora: true },
    })
  })
})

describe('totalAdeudado', () => {
  it('es la suma en centavos de los importes de leerAdeudados (los null no suman)', async () => {
    precios.set(3, 10000.5)
    precios.set(5, null)
    turnos = [
      { id: 1, bloqueAgendaId: 10, materiaId: 3, fechaInicio: '2026-09-14', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, materiaId: 5, fechaInicio: '2026-09-29', fechaFin: null },
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })
    const total = await totalAdeudado(cliente(), { hoy: HOY })

    // Lunes 14/09, 21/09 y 28/09 a 10.000,50; martes 29/09 sin precio.
    expect(adeudados).toHaveLength(4)
    expect(total).toBe(30001.5)
  })

  it('respeta todos los filtros: es la suma de los adeudados del mismo filtro', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, materiaId: 3, fechaInicio: '2026-09-07', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, materiaId: 5, fechaInicio: '2026-09-08', fechaFin: null },
      {
        id: 3,
        bloqueAgendaId: 10,
        alumnoId: 15,
        materiaId: 3,
        fechaInicio: '2026-09-07',
        fechaFin: null,
      },
    ]
    const filtro = {
      alumnoId: 12,
      materiaId: 3,
      profesorId: 4,
      desde: '2026-09-14',
      hasta: '2026-12-31',
      hoy: HOY,
    }

    const adeudados = await leerAdeudados(cliente(), filtro)

    // Lunes 14/09, 21/09 y 28/09 del turno 1: el 07/09 queda fuera del período y hoy no adeuda.
    expect(claves(adeudados)).toEqual([
      [1, '2026-09-14'],
      [1, '2026-09-21'],
      [1, '2026-09-28'],
    ])
    expect(await totalAdeudado(cliente(), filtro)).toBe(24000)
  })

  it('sin deuda → 0', async () => {
    expect(await totalAdeudado(cliente(), { alumnoId: 12, hoy: HOY })).toBe(0)
  })
})

describe('leerProximos', () => {
  it('de hoy a hoy + 56, agendados e impagos, con importe; + 57, cancelados y pagados no', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-10-12' }],
        pagos: [{ fecha: '2026-10-19', pagoId: 9, importe: 8000 }],
      },
      { id: 2, bloqueAgendaId: 40, materiaId: 5, fechaInicio: '2026-12-01', fechaFin: null },
    ]

    const proximos = await leerProximos(cliente(), { alumnoId: 12, hoy: HOY })

    const fechas = proximos.map(({ ocurrencia }) => ocurrencia.fecha)
    expect(fechas[0]).toBe(HOY)
    expect(fechas.at(-1)).toBe('2026-11-30')
    expect(fechas).not.toContain('2026-10-12')
    expect(fechas).not.toContain('2026-10-19')
    expect(fechas).not.toContain('2026-12-01')
    expect(proximos).toHaveLength(7) // 05/10, 26/10, 02/11, 09/11, 16/11, 23/11, 30/11
    expect(proximos.every((p) => p.ocurrencia.estado === 'AGENDADO' && p.importe === 8000)).toBe(
      true,
    )
    expect(rangoLeido()).toEqual({ gte: d(HOY), lte: d('2026-11-30') })
  })

  it('sin alumnoId: los de todos los alumnos, por fecha, hora y turnoId', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 40,
        alumnoId: 15,
        fechaInicio: '2026-10-06',
        fechaFin: '2026-10-13',
      },
      {
        id: 2,
        bloqueAgendaId: 10,
        alumnoId: 12,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-12',
      },
    ]

    const proximos = await leerProximos(cliente(), { hoy: HOY })

    expect(base.findMany.mock.calls[0]?.[0].where.alumnoId).toBeUndefined()
    expect(claves(proximos)).toEqual([
      [2, '2026-10-05'],
      [1, '2026-10-06'],
      [2, '2026-10-12'],
      [1, '2026-10-13'],
    ])
    expect(proximos.map((p) => p.ocurrencia.alumno.id)).toEqual([12, 15, 12, 15])
  })

  it('con un período que cruza hoy y pasa el tope: de hoy al tope', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-07', fechaFin: null }]

    const proximos = await leerProximos(cliente(), {
      desde: '2026-09-01',
      hasta: '2027-03-31',
      hoy: HOY,
    })

    expect(rangoLeido()).toEqual({ gte: d(HOY), lte: d('2026-11-30') })
    expect(proximos).toHaveLength(9) // lunes 05/10 a 30/11
  })

  it('con un período dentro de la ventana: sólo ese período', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-07', fechaFin: null }]

    const proximos = await leerProximos(cliente(), {
      desde: '2026-10-12',
      hasta: '2026-10-19',
      hoy: HOY,
    })

    expect(rangoLeido()).toEqual({ gte: d('2026-10-12'), lte: d('2026-10-19') })
    expect(claves(proximos)).toEqual([
      [1, '2026-10-12'],
      [1, '2026-10-19'],
    ])
  })

  it('período sólo pasado o que empieza después del tope: [] sin consultar', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-07', fechaFin: null }]
    const client = cliente()

    expect(await leerProximos(client, { hasta: '2026-10-04', hoy: HOY })).toEqual([])
    expect(await leerProximos(client, { desde: '2026-12-01', hoy: HOY })).toEqual([])
    expect(base.findMany).not.toHaveBeenCalled()
  })

  it('materia y profesor los filtra el motor', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        materiaId: 3,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
      },
      {
        id: 2,
        bloqueAgendaId: 40,
        materiaId: 5,
        fechaInicio: '2026-10-06',
        fechaFin: '2026-10-06',
      },
    ]

    const proximos = await leerProximos(cliente(), { materiaIds: [5], profesorId: 7, hoy: HOY })

    const where = base.findMany.mock.calls[0]?.[0].where
    expect(where.materiaId).toEqual({ in: [5] })
    expect(where.bloqueAgenda?.profesorId).toBe(7)
    expect(claves(proximos)).toEqual([[2, '2026-10-06']])
  })
})

// T-101: varias materias (HU-25) en una sola lectura del motor.
describe('varias materias', () => {
  // Matemática (3) los lunes, Inglés (5) los martes y Física (7) los sábados, desde el 07/09.
  beforeEach(() => {
    precios.set(7, 7000)
    turnos = [
      { id: 1, bloqueAgendaId: 10, materiaId: 3, fechaInicio: '2026-09-21', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, materiaId: 5, fechaInicio: '2026-09-22', fechaFin: null },
      { id: 3, bloqueAgendaId: 60, materiaId: 7, fechaInicio: '2026-09-07', fechaFin: null },
    ]
  })

  it('Matemática e Inglés: sus adeudados y próximos, ninguno de Física, en una lectura', async () => {
    const filtro = { materiaIds: [3, 5], hoy: HOY }

    const adeudados = await leerAdeudados(cliente(), filtro)
    expect(base.findMany).toHaveBeenCalledTimes(1)
    expect(base.findMany.mock.calls[0]?.[0].where.materiaId).toEqual({ in: [3, 5] })
    // El rango empieza en el primer turno de esas materias, no en el de Física.
    expect(rangoLeido()).toEqual({ gte: d('2026-09-21'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([
      [1, '2026-09-21'],
      [2, '2026-09-22'],
      [1, '2026-09-28'],
      [2, '2026-09-29'],
    ])
    expect(await totalAdeudado(cliente(), filtro)).toBe(34000)

    const proximos = await leerProximos(cliente(), { ...filtro, hasta: '2026-10-13' })
    expect(claves(proximos)).toEqual([
      [1, '2026-10-05'],
      [2, '2026-10-06'],
      [1, '2026-10-12'],
      [2, '2026-10-13'],
    ])
  })

  it('una sola materia trae lo mismo que antes: sólo la suya', async () => {
    expect(claves(await leerAdeudados(cliente(), { materiaIds: [5], hoy: HOY }))).toEqual([
      [2, '2026-09-22'],
      [2, '2026-09-29'],
    ])
  })

  it('un id repetido no duplica: cada materia una vez en el filtro y cada turno una vez', async () => {
    const adeudados = await leerAdeudados(cliente(), { materiaIds: [5, 3, 5], hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.materiaId).toEqual({ in: [5, 3] })
    expect(base.findMany.mock.calls[0]?.[0].where.materiaId).toEqual({ in: [5, 3] })
    expect(adeudados).toHaveLength(4)
  })

  it('sin materias o con la lista vacía: todas, sin filtro de materia', async () => {
    const vacia = await leerAdeudados(cliente(), { materiaIds: [], hoy: HOY })

    expect(aggregate.mock.calls[0]?.[0].where.materiaId).toBeUndefined()
    expect(base.findMany.mock.calls[0]?.[0].where.materiaId).toBeUndefined()
    expect(vacia).toHaveLength((await leerAdeudados(cliente(), { hoy: HOY })).length)
    expect(vacia.some((a) => a.ocurrencia.materiaId === 7)).toBe(true)
  })
})

// T-76: la deuda con asistencia (HU-22) y los pagos anulados (lo resuelve el motor, T-74).
describe('deuda con asistencia y pagos anulados', () => {
  it.each([
    ['PRESENTE', 'REALIZADO'],
    ['AUSENTE', 'AUSENTE'],
  ] as const)('un %s pasado e impago adeuda y suma al total (%s)', async (asistencia, estado) => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        asistencias: [{ fecha: '2026-09-28', estado: asistencia }],
      },
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    expect(claves(adeudados)).toEqual([[1, '2026-09-28']])
    expect(adeudados[0]?.ocurrencia.estado).toBe(estado)
    expect(await totalAdeudado(cliente(), { hoy: HOY })).toBe(8000)
  })

  it('un "Sin registrar" cerrado por el sistema (sin asistencia y con el plazo vencido) adeuda', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-21', fechaFin: '2026-09-21' }]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    expect(claves(adeudados)).toEqual([[1, '2026-09-21']])
    expect(adeudados[0]?.ocurrencia.estado).toBe('SIN_REGISTRAR')
    expect(adeudados[0]?.ocurrencia.plazoAsistencia?.vencido).toBe(true)
  })

  it('un pago anulado no cuenta: vuelve a los adeudados; con otro pago vigente de la misma fecha, no', async () => {
    const anulado = { fecha: '2026-09-28', pagoId: 9, importe: 8000, vigente: false }
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        pagos: [anulado],
      },
    ]

    expect(claves(await leerAdeudados(cliente(), { hoy: HOY }))).toEqual([[1, '2026-09-28']])

    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        pagos: [anulado, { fecha: '2026-09-28', pagoId: 10, importe: 8000 }],
      },
    ]

    expect(await leerAdeudados(cliente(), { hoy: HOY })).toEqual([])
  })

  it('un turno de hoy con asistencia es próximo, no adeudado', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: HOY,
        fechaFin: HOY,
        asistencias: [{ fecha: HOY, estado: 'PRESENTE' }],
      },
    ]

    const proximos = await leerProximos(cliente(), { hoy: HOY })

    expect(claves(proximos)).toEqual([[1, HOY]])
    expect(proximos[0]?.ocurrencia.estado).toBe('REALIZADO')
    expect(await leerAdeudados(cliente(), { hoy: HOY })).toEqual([])
  })
})

describe('deudaVencida', () => {
  it('cuenta la de hace 30 días y no la de hace 29', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 60, fechaInicio: '2026-09-05', fechaFin: '2026-09-05' }, // hoy - 30
      { id: 2, bloqueAgendaId: 30, fechaInicio: '2026-09-06', fechaFin: '2026-09-06' }, // hoy - 29
    ]

    expect(await deudaVencida(cliente(), { alumnoId: 12, hoy: HOY })).toEqual({
      cantidad: 1,
      total: 8000,
    })
  })

  it('coincide con los adeudados de 30 días o más (cantidad y total)', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-07-06',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-07-13' }],
        pagos: [
          { fecha: '2026-07-20', pagoId: 9, importe: 8000 },
          { fecha: '2026-07-27', pagoId: 8, importe: 8000, vigente: false },
        ],
        asistencias: [{ fecha: '2026-08-03', estado: 'PRESENTE' }],
      },
      {
        id: 2,
        bloqueAgendaId: 40,
        materiaId: 5,
        fechaInicio: '2026-08-04',
        fechaFin: null,
        asistencias: [{ fecha: '2026-08-11', estado: 'AUSENTE' }],
      },
    ]

    const vencida = await deudaVencida(cliente(), { alumnoId: 12, hoy: HOY })
    const adeudados = (await leerAdeudados(cliente(), { alumnoId: 12, hoy: HOY })).filter(
      ({ ocurrencia }) => ocurrencia.fecha <= '2026-09-05',
    )

    // Lunes 06/07, 27/07 (pago anulado) y 03/08 a 31/08 (5); martes 04/08 a 01/09 (5).
    expect(adeudados).toHaveLength(12)
    expect(vencida).toEqual({ cantidad: adeudados.length, total: totalDe(adeudados) })
    expect(vencida.total).toBe(7 * 8000 + 5 * 9000)
  })

  it('una materia sin precio suma a la cantidad pero no al total', async () => {
    precios.set(5, null)
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        materiaId: 3,
        fechaInicio: '2026-08-31',
        fechaFin: '2026-08-31',
      },
      {
        id: 2,
        bloqueAgendaId: 40,
        materiaId: 5,
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-01',
      },
    ]

    expect(await deudaVencida(cliente(), { alumnoId: 12, hoy: HOY })).toEqual({
      cantidad: 2,
      total: 8000,
    })
  })

  it('la deuda de otro alumno no cuenta', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, alumnoId: 15, fechaInicio: '2026-08-03', fechaFin: null },
    ]

    expect(await deudaVencida(cliente(), { alumnoId: 12, hoy: HOY })).toEqual({
      cantidad: 0,
      total: 0,
    })
  })

  it('sin turnos → { cantidad: 0, total: 0 }', async () => {
    expect(await deudaVencida(cliente(), { alumnoId: 12, hoy: HOY })).toEqual({
      cantidad: 0,
      total: 0,
    })
  })
})
