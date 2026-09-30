import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crearTurnosEnMemoria,
  d,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from '@/server/features/turnos/__tests__/turnos-en-memoria'
import {
  leerAdeudados,
  leerProximos,
  totalAdeudado,
  type ClienteOcurrencias,
} from '../cuentas.condiciones'

// Condiciones de la deuda (T-53). Excepcional, a nivel de consulta (como el motor de T-30): el
// cliente es un falso que aplica el `where` sobre la tabla en memoria de `turnos-en-memoria.ts`,
// así se prueban juntos el motor real, las reglas de `cuentas.reglas.ts` y el rango "desde". El
// `aggregate` y los precios son falsos del mismo estilo.
//
// Hoy: lunes 05/10/2026. Ayer: domingo 04/10. Hoy + 56 = lunes 30/11; hoy + 57 = martes 01/12.

const HOY = '2026-10-05'

const BLOQUES: BloqueDePrueba[] = [
  { id: 10, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 540 }, // lunes 9–10
  { id: 30, profesorId: 4, aulaId: 1, diaSemana: 7, horaInicio: 540 }, // domingo 9–10
  { id: 40, profesorId: 7, aulaId: 2, diaSemana: 2, horaInicio: 600 }, // martes 10–11
]

type WhereAggregate = { estado: string; fechaInicio: { lt: Date }; alumnoId?: number }

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
          d(t.fechaInicio) < where.fechaInicio.lt &&
          (where.alumnoId === undefined || (t.alumnoId ?? 12) === where.alumnoId),
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

  it('"desde" es la fechaInicio más antigua de los turnos ACTIVO que empezaron antes de hoy; "hasta" es ayer', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      { id: 2, bloqueAgendaId: 40, fechaInicio: '2026-08-04', fechaFin: '2026-08-11' },
      { id: 3, bloqueAgendaId: 10, fechaInicio: '2026-07-06', fechaFin: null, estado: 'CANCELADO' },
      { id: 4, bloqueAgendaId: 10, fechaInicio: '2026-10-12', fechaFin: null }, // futuro
    ]

    const adeudados = await leerAdeudados(cliente(), { hoy: HOY })

    expect(aggregate).toHaveBeenCalledWith({
      where: { estado: 'ACTIVO', fechaInicio: { lt: d(HOY) } },
      _min: { fechaInicio: true },
    })
    const rango = base.findMany.mock.calls[0]?.[0].select.cancelaciones.where.fechaOcurrencia
    expect(rango).toEqual({ gte: d('2026-08-04'), lte: d('2026-10-04') })
    expect(claves(adeudados)).toEqual([
      [2, '2026-08-04'],
      [2, '2026-08-11'],
      [1, '2026-09-28'],
    ])
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
    const rango = base.findMany.mock.calls[0]?.[0].select.cancelaciones.where.fechaOcurrencia
    expect(rango).toEqual({ gte: d(HOY), lte: d('2026-11-30') })
  })
})
