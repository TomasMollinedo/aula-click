import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fechaADate } from '@/server/shared/fechas'
import {
  cierreDeLiquidacion,
  cobrosConReparto,
  leerAnulacionesPendientes,
  leerDevengados,
  liquidacionDe,
  liquidacionesDelMes,
  liquidacionesDelProfesor,
  saldoAPagarPorProfesor,
  type ClienteLiquidaciones,
} from '../liquidaciones.condiciones'

// Lecturas del motor de liquidaciones (T-121) con un cliente falso que devuelve filas con la forma
// del `select`: se prueba la consulta que arman, el cruce en memoria y que delegan en las reglas
// (las reglas en sí se prueban en `liquidaciones.reglas.test.ts`). Sin base.

const pagoTurnoFindMany = vi.fn()
const asistenciaFindMany = vi.fn()
const liquidacionTurnoFindMany = vi.fn()
const liquidacionFindMany = vi.fn()

const cliente = {
  pagoTurno: { findMany: pagoTurnoFindMany },
  asistenciaTurno: { findMany: asistenciaFindMany },
  liquidacionTurno: { findMany: liquidacionTurnoFindMany },
  liquidacion: { findMany: liquidacionFindMany },
} as unknown as ClienteLiquidaciones

/** Un `Prisma.Decimal` falso: lo único que usan las condiciones es `toNumber()`. */
const dec = (valor: number) => ({ toNumber: () => valor })

const GOMEZ = { id: 1, usuario: { nombre: 'Ana', apellido: 'Gómez' } }
const RUIZ = { id: 2, usuario: { nombre: 'Carla', apellido: 'Ruiz' } }
const ALUMNO = { id: 7, nombre: 'Juan', apellido: 'Pérez' }
const MATERIA = { id: 3, nombre: 'Matemática' }

const turnoDe = (profesor: typeof GOMEZ) => ({
  alumno: ALUMNO,
  materia: MATERIA,
  bloqueAgenda: { horaInicio: 540, horaFin: 600, profesor },
})

/** Una fila de `pagoTurno` con el `select` de los cobros. Instantes a las 12:00 de Salta. */
function cobro({
  id,
  turnoId = id,
  fecha,
  registradoEl,
  fechaPago = fecha,
  importe = 10000,
  porcentaje = 15,
  profesor = GOMEZ,
}: {
  id: number
  turnoId?: number
  fecha: string
  registradoEl: string
  fechaPago?: string
  importe?: number
  porcentaje?: number
  profesor?: typeof GOMEZ
}) {
  return {
    id,
    pagoId: 500 + id,
    turnoId,
    fechaOcurrencia: fechaADate(fecha),
    importeAplicado: dec(importe),
    porcentajeCentro: dec(porcentaje),
    pago: {
      createdAt: new Date(`${registradoEl}T15:00:00Z`),
      numeroComprobante: 100 + id,
      fechaPago: fechaADate(fechaPago),
    },
    turno: turnoDe(profesor),
  }
}

function asistencia(turnoId: number, fecha: string, registradaEl: string = fecha) {
  return {
    turnoId,
    fechaOcurrencia: fechaADate(fecha),
    estado: 'PRESENTE' as const,
    createdAt: new Date(`${registradaEl}T15:00:00Z`),
  }
}

function anulacionPendiente(
  id: number,
  mesOrigen: string,
  parteProfesor: number,
  profesor = GOMEZ,
) {
  return {
    id,
    parteProfesor: dec(parteProfesor),
    liquidacion: { mes: fechaADate(`${mesOrigen}-01`), profesor },
    pagoTurno: { pago: { numeroComprobante: 900 + id } },
  }
}

type FilaCerrada = ReturnType<typeof cerrada>

/** Una `Liquidacion` cerrada con el `select` de la lectura, con un turno congelado. */
function cerrada({
  id,
  mes,
  profesor = GOMEZ,
  importe = 10000,
  porcentaje = 12,
  parteProfesor = 8800,
}: {
  id: number
  mes: string
  profesor?: typeof GOMEZ
  importe?: number
  porcentaje?: number
  parteProfesor?: number
}) {
  return {
    id,
    mes: fechaADate(`${mes}-01`),
    estado: 'PAGADA' as const,
    totalCobrado: dec(importe),
    parteCentro: dec(importe - parteProfesor),
    parteProfesor: dec(parteProfesor),
    totalAjustes: dec(0),
    total: dec(parteProfesor),
    fechaTransferencia: fechaADate(`${mes}-28`),
    numeroOperacion: 'OP-1',
    observaciones: null,
    createdAt: new Date(`${mes}-28T15:00:00Z`),
    createdBy: { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' },
    profesor,
    descontadaEn: null,
    turnos: [
      {
        fechaDevengo: fechaADate(`${mes}-05`),
        importe: dec(importe),
        porcentajeCentro: dec(porcentaje),
        parteProfesor: dec(parteProfesor),
        pagoTurno: {
          id: 10 * id,
          turnoId: 10 * id,
          fechaOcurrencia: fechaADate(`${mes}-05`),
          pago: { numeroComprobante: 900 + id },
          turno: turnoDe(profesor),
        },
      },
    ],
    ajustesAplicados: [],
  }
}

let cerradas: FilaCerrada[]

type WhereLiquidacion = { profesorId?: number; mes?: { gte?: Date; lte?: Date } }

beforeEach(() => {
  cerradas = []
  for (const fn of [pagoTurnoFindMany, asistenciaFindMany, liquidacionTurnoFindMany]) {
    fn.mockReset().mockResolvedValue([])
  }
  // Las cerradas completas (con `turnos` en el `select`) o sólo sus meses, con el filtro aplicado.
  liquidacionFindMany
    .mockReset()
    .mockImplementation(
      async ({ where, select }: { where: WhereLiquidacion; select: { turnos?: unknown } }) => {
        const filas = cerradas.filter(
          (c) =>
            (where.profesorId === undefined || c.profesor.id === where.profesorId) &&
            (!where.mes?.gte || c.mes >= where.mes.gte) &&
            (!where.mes?.lte || c.mes <= where.mes.lte),
        )
        return select.turnos ? filas : filas.map((c) => ({ profesorId: c.profesor.id, mes: c.mes }))
      },
    )
})

describe('leerDevengados', () => {
  it('pide los cobros vigentes sin liquidar y, con profesor, los de su bloque', async () => {
    await leerDevengados(cliente, { profesorId: 1, hasta: '2026-11-15' })
    await leerDevengados(cliente, { hasta: '2026-11-15' })

    expect(pagoTurnoFindMany.mock.calls[0][0].where).toEqual({
      vigente: true,
      liquidacionTurno: { is: null },
      turno: { bloqueAgenda: { profesorId: 1 } },
    })
    expect(pagoTurnoFindMany.mock.calls[1][0].where).toEqual({
      vigente: true,
      liquidacionTurno: { is: null },
    })
  })

  it('dos consultas sin importar cuántos turnos, y ninguna de asistencias si no hay cobros', async () => {
    await leerDevengados(cliente, { hasta: '2026-11-15' })
    expect(asistenciaFindMany).not.toHaveBeenCalled()

    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-05', registradoEl: '2026-10-01' }),
      cobro({ id: 2, turnoId: 1, fecha: '2026-10-12', registradoEl: '2026-10-01' }),
      cobro({ id: 3, turnoId: 2, fecha: '2026-10-06', registradoEl: '2026-10-01' }),
    ])
    await leerDevengados(cliente, { hasta: '2026-11-15' })

    expect(pagoTurnoFindMany).toHaveBeenCalledTimes(2)
    expect(asistenciaFindMany).toHaveBeenCalledTimes(1)
    expect(asistenciaFindMany.mock.calls[0][0].where).toEqual({ turnoId: { in: [1, 2] } })
  })

  it('cruza la asistencia por turno y fecha; sin asistencia, no viene', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-05', registradoEl: '2026-10-01' }),
      cobro({ id: 2, turnoId: 1, fecha: '2026-10-12', registradoEl: '2026-10-01' }),
      cobro({ id: 3, turnoId: 2, fecha: '2026-10-05', registradoEl: '2026-10-01' }),
    ])
    // Sólo el turno 1 del 12/10 tiene asistencia; la del turno 2 es de otra fecha.
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-10-12'), asistencia(2, '2026-10-06')])

    const devengados = await leerDevengados(cliente, { hasta: '2026-11-15' })

    expect(devengados).toEqual([
      {
        pagoTurnoId: 2,
        turnoId: 1,
        fecha: '2026-10-12',
        horaInicio: 540,
        horaFin: 600,
        alumno: ALUMNO,
        materia: MATERIA,
        profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' },
        numeroComprobante: 102,
        importe: 10000,
        porcentaje: 15,
        fechaDevengo: '2026-10-12',
      },
    ])
  })

  it('pago registrado el 3/11 con fecha de pago 28/10 y asistencia del 20/10 → devengo el 3/11', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-20', fechaPago: '2026-10-28', registradoEl: '2026-11-03' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-10-20')])

    const [devengado] = await leerDevengados(cliente, { hasta: '2026-11-15' })

    expect(devengado.fechaDevengo).toBe('2026-11-03')
  })

  it('no trae lo devengado después de `hasta`', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-11-10', registradoEl: '2026-11-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-11-10', '2026-11-16')])

    expect(await leerDevengados(cliente, { hasta: '2026-11-15' })).toEqual([])
  })

  it('turno reprogramado a otro profesor antes de la asistencia → es del profesor del bloque actual', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-20', registradoEl: '2026-10-01', profesor: RUIZ }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-10-20')])

    const [devengado] = await leerDevengados(cliente, { hasta: '2026-11-15' })

    expect(devengado.profesor).toEqual({ id: 2, nombre: 'Carla', apellido: 'Ruiz' })
  })
})

describe('leerAnulacionesPendientes', () => {
  it('pide los turnos liquidados con el pago anulado (vigente null) y sin ajuste', async () => {
    liquidacionTurnoFindMany.mockResolvedValue([anulacionPendiente(4, '2026-09', 8500)])

    const anulaciones = await leerAnulacionesPendientes(cliente, { profesorId: 1 })

    expect(liquidacionTurnoFindMany.mock.calls[0][0].where).toEqual({
      pagoTurno: { vigente: null },
      ajuste: { is: null },
      liquidacion: { profesorId: 1 },
    })
    expect(anulaciones).toEqual([
      {
        liquidacionTurnoId: 4,
        profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' },
        mesOrigen: '2026-09',
        numeroComprobante: 904,
        parteProfesor: 8500,
      },
    ])
  })
})

describe('liquidacionDe', () => {
  it('una cerrada no cambia si después se anula un pago de sus turnos: el ajuste va a la primera abierta posterior', async () => {
    // Octubre se pagó con el porcentaje de entonces (12 %); después se anuló el cobro de su turno.
    cerradas = [cerrada({ id: 1, mes: '2026-10', importe: 5000, parteProfesor: 4400 })]
    liquidacionTurnoFindMany.mockResolvedValue([anulacionPendiente(10, '2026-10', 4400)])
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 2, fecha: '2026-11-05', registradoEl: '2026-11-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(2, '2026-11-05')])
    const hoy = '2026-12-10'

    const octubre = await liquidacionDe(cliente, { profesorId: 1, mes: '2026-10', hoy })
    const noviembre = await liquidacionDe(cliente, { profesorId: 1, mes: '2026-11', hoy })

    expect(octubre).toMatchObject({
      estado: 'PAGADA',
      totalCobrado: 5000,
      parteCentro: 600,
      parteProfesor: 4400,
      total: 4400,
      ajustes: [],
      cerrada: { id: 1, fechaTransferencia: '2026-10-28', descontadaEnMes: null },
    })
    expect(octubre?.turnos).toMatchObject([
      { pagoTurnoId: 10, porcentaje: 12, parteCentro: 600, parteProfesor: 4400 },
    ])
    expect(noviembre).toMatchObject({
      estado: 'PENDIENTE_DE_PAGO',
      cerrada: null,
      totalAjustes: -4400,
      total: 4100, // 8.500 del turno de noviembre − 4.400 del ajuste
    })
  })
})

describe('liquidacionesDelMes', () => {
  it('mezcla la cerrada de un profesor con la abierta de otro, ordenadas por profesor', async () => {
    cerradas = [cerrada({ id: 1, mes: '2026-11', profesor: RUIZ })]
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 2, fecha: '2026-11-05', registradoEl: '2026-11-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(2, '2026-11-05')])

    const liquidaciones = await liquidacionesDelMes(cliente, { mes: '2026-11', hoy: '2026-12-10' })

    expect(
      liquidaciones.map((l) => [l.profesor.apellido, l.estado, l.cerrada?.id ?? null]),
    ).toEqual([
      ['Gómez', 'PENDIENTE_DE_PAGO', null],
      ['Ruiz', 'PAGADA', 1],
    ])
    const lecturaCerradas = liquidacionFindMany.mock.calls.find(([args]) => args.select.turnos)
    expect(lecturaCerradas?.[0].where).toEqual({
      mes: { gte: fechaADate('2026-11-01'), lte: fechaADate('2026-11-30') },
    })
  })

  it('un mes posterior al actual → [] sin consultar', async () => {
    expect(await liquidacionesDelMes(cliente, { mes: '2027-01', hoy: '2026-12-10' })).toEqual([])
    expect(pagoTurnoFindMany).not.toHaveBeenCalled()
    expect(liquidacionFindMany).not.toHaveBeenCalled()
  })
})

describe('liquidacionesDelProfesor', () => {
  it('las cerradas y las abiertas del profesor, una por mes, ordenadas por mes', async () => {
    cerradas = [cerrada({ id: 1, mes: '2026-10' })]
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 2, fecha: '2026-11-05', registradoEl: '2026-11-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(2, '2026-11-05')])

    const liquidaciones = await liquidacionesDelProfesor(cliente, {
      profesorId: 1,
      hoy: '2026-12-10',
    })

    expect(liquidaciones.map((l) => [l.mes, l.estado, l.cerrada?.id ?? null])).toEqual([
      ['2026-10', 'PAGADA', 1],
      ['2026-11', 'PENDIENTE_DE_PAGO', null],
    ])
    // Las cerradas, de ese profesor y de todos los meses.
    const lecturaCerradas = liquidacionFindMany.mock.calls.find(([args]) => args.select.turnos)
    expect(lecturaCerradas?.[0].where).toEqual({ profesorId: 1 })
  })

  it('sin movimientos → []', async () => {
    expect(await liquidacionesDelProfesor(cliente, { profesorId: 1, hoy: '2026-12-10' })).toEqual(
      [],
    )
  })
})

describe('saldoAPagarPorProfesor', () => {
  it('pendiente + en curso de uno, y el negativo del otro', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-11-05', registradoEl: '2026-11-01' }),
      cobro({ id: 2, fecha: '2026-12-03', registradoEl: '2026-12-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-11-05'), asistencia(2, '2026-12-03')])
    cerradas = [cerrada({ id: 3, mes: '2026-11', profesor: RUIZ })]
    liquidacionTurnoFindMany.mockResolvedValue([anulacionPendiente(30, '2026-11', 2000, RUIZ)])

    expect(await saldoAPagarPorProfesor(cliente, { hoy: '2026-12-10' })).toEqual([
      { profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' }, saldo: 17000 },
      { profesor: { id: 2, nombre: 'Carla', apellido: 'Ruiz' }, saldo: -2000 },
    ])
  })
})

describe('cobrosConReparto', () => {
  it('trae los cobros vigentes del rango por fecha de pago, con su reparto y si quedaron cerrados sin registrar', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-01', registradoEl: '2026-10-01' }),
      cobro({ id: 2, fecha: '2026-10-01', registradoEl: '2026-10-01', porcentaje: 12 }),
      cobro({ id: 3, fecha: '2026-11-12', registradoEl: '2026-11-02' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-10-01')])

    const cobros = await cobrosConReparto(cliente, {
      desde: '2026-10-01',
      hasta: '2026-11-30',
      hoy: '2026-11-15',
    })

    expect(pagoTurnoFindMany.mock.calls[0][0].where).toEqual({
      vigente: true,
      pago: { fechaPago: { gte: fechaADate('2026-10-01'), lte: fechaADate('2026-11-30') } },
    })
    expect(cobros.map((c) => [c.pagoTurnoId, c.cerradaSinRegistrar])).toEqual([
      [1, false], // con asistencia
      [2, true], // sin asistencia y venció el 8/10
      [3, false], // sin asistencia, vence el 19/11
    ])
    expect(cobros[1]).toMatchObject({
      pagoId: 502,
      numeroComprobante: 102,
      fechaPago: '2026-10-01',
      fechaOcurrencia: '2026-10-01',
      profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' },
      reparto: { importe: 10000, porcentaje: 12, parteCentro: 1200, parteProfesor: 8800 },
    })
  })
})

describe('cierreDeLiquidacion', () => {
  it('de punta a punta con una cadena de saldos: las dos a descontar y la pagada, en orden', async () => {
    // Septiembre cerrado y su turno anulado (−2.000); octubre y noviembre quedan negativos.
    cerradas = [cerrada({ id: 9, mes: '2026-09' })]
    liquidacionTurnoFindMany.mockResolvedValue([anulacionPendiente(90, '2026-09', 2000)])
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-10-05', registradoEl: '2026-10-01', importe: 1000 }),
      cobro({ id: 2, fecha: '2026-11-05', registradoEl: '2026-11-01', importe: 1000 }),
      cobro({ id: 3, fecha: '2026-12-05', registradoEl: '2026-12-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([
      asistencia(1, '2026-10-05'),
      asistencia(2, '2026-11-05'),
      asistencia(3, '2026-12-05'),
    ])

    const cierre = await cierreDeLiquidacion(cliente, {
      profesorId: 1,
      mes: '2026-12',
      hoy: '2027-01-10',
    })

    expect(cierre?.escrituras.map((e) => [e.mes, e.estado, e.descontadaEnMes, e.total])).toEqual([
      ['2026-10', 'DESCONTADA', '2026-11', -1150],
      ['2026-11', 'DESCONTADA', '2026-12', -300],
      ['2026-12', 'PAGADA', null, 8200],
    ])
    expect(cierre?.escrituras[0].ajustes).toEqual([
      { tipo: 'ANULACION', liquidacionTurnoId: 90, importe: -2000 },
    ])
    expect(pagoTurnoFindMany.mock.calls[0][0].where).toMatchObject({
      turno: { bloqueAgenda: { profesorId: 1 } },
    })
  })

  it('null para el mes en curso', async () => {
    pagoTurnoFindMany.mockResolvedValue([
      cobro({ id: 1, fecha: '2026-12-05', registradoEl: '2026-12-01' }),
    ])
    asistenciaFindMany.mockResolvedValue([asistencia(1, '2026-12-05')])

    expect(
      await cierreDeLiquidacion(cliente, { profesorId: 1, mes: '2026-12', hoy: '2026-12-10' }),
    ).toBeNull()
  })
})
