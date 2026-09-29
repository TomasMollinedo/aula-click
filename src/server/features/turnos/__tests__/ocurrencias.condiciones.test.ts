import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bloquearAlumno,
  bloquearParaReserva,
  claveOcupacion,
  leerOcurrencias,
  materiasDelProfesorConAlumno,
  ocupacionEn,
  ocupacionesEn,
  superposicionesDelAlumno,
  type ClienteOcurrencias,
} from '../ocurrencias.condiciones'
import { crearTurnosEnMemoria, type BloqueDePrueba, type TurnoDePrueba } from './turnos-en-memoria'

// Motor de ocurrencias (T-30). Excepcional, a nivel de consulta (como el test de T-23): el cliente
// es un falso que aplica el `where` sobre una tabla en memoria (`turnos-en-memoria.ts`), así se
// prueban juntos el prefiltro de la base y las reglas puras que se aplican después. Un caso por
// regla.
//
// Fechas: 28/09/2026 es lunes (28/09, 05/10, 12/10, 19/10, 26/10, 02/11 son lunes).

const BLOQUES: BloqueDePrueba[] = [
  { id: 10, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 540 }, // lunes 9–10, Ana
  { id: 11, profesorId: 4, aulaId: 1, diaSemana: 1, horaInicio: 600 }, // lunes 10–11, Ana
  { id: 20, profesorId: 7, aulaId: 2, diaSemana: 1, horaInicio: 540 }, // lunes 9–10, Juan
  { id: 30, profesorId: 4, aulaId: 1, diaSemana: 7, horaInicio: 540 }, // domingo 9–10, Ana
]

/** Mediodía del lunes 05/10/2026 en Salta (UTC-3). */
const reloj = () => new Date('2026-10-05T15:00:00Z')

let turnos: TurnoDePrueba[]
let base: ReturnType<typeof crearTurnosEnMemoria>
let materiaFindMany: ReturnType<typeof vi.fn>
let queryRaw: ReturnType<typeof vi.fn>

function cliente(): ClienteOcurrencias {
  base = crearTurnosEnMemoria(BLOQUES, turnos)
  return {
    turno: { findMany: base.findMany },
    materia: { findMany: materiaFindMany },
    $queryRaw: queryRaw,
  } as unknown as ClienteOcurrencias
}

beforeEach(() => {
  turnos = []
  materiaFindMany = vi.fn().mockResolvedValue([])
  queryRaw = vi.fn().mockResolvedValue([])
})

const fechasDe = (ocurrencias: { turnoId: number; fecha: string }[]) =>
  ocurrencias.map((o) => [o.turnoId, o.fecha])

// ---------------------------------------------------------------------------------------------
// leerOcurrencias
// ---------------------------------------------------------------------------------------------

describe('leerOcurrencias', () => {
  it('recurrente partido en dos tramos: cada tramo genera sus fechas y no se pisan', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: '2026-10-12' },
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-26', fechaFin: null },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-09-28', hasta: '2026-11-02' },
      reloj,
    )

    expect(fechasDe(ocurrencias)).toEqual([
      [1, '2026-09-28'],
      [1, '2026-10-05'],
      [1, '2026-10-12'],
      [2, '2026-10-26'],
      [2, '2026-11-02'],
    ])
  })

  it('arma cada ocurrencia con su bloque, sus referencias y su serie (horas en minutos)', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: null }]

    const [ocurrencia] = await leerOcurrencias(
      cliente(),
      { desde: '2026-10-05', hasta: '2026-10-05' },
      reloj,
    )

    expect(ocurrencia).toEqual({
      turnoId: 1,
      fecha: '2026-10-05',
      bloqueAgendaId: 10,
      diaSemana: 1,
      horaInicio: 540,
      horaFin: 600,
      profesorId: 4,
      aulaId: 1,
      alumnoId: 12,
      materiaId: 3,
      tipo: 'RECURRENTE',
      estado: 'AGENDADO',
      pago: { estado: 'PENDIENTE' },
      serie: { fechaInicio: '2026-10-05', fechaFin: null, finEfectivo: null },
      alumno: {
        id: 12,
        nombre: 'Alumno12',
        apellido: 'Apellido12',
        busqueda: 'apellido12 alumno12',
      },
      profesor: { id: 4, nombre: 'Profe4', apellido: 'Apellido4', busqueda: 'apellido4 profe4' },
      materia: { id: 3, nombre: 'Materia3' },
      aula: { id: 1, nombre: 'Aula 1' },
    })
  })

  it('una cancelación: esa fecha sale CANCELADO con la cancelación completa; el resto sigue igual', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-05',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-10-12', motivo: 'OTRO', detalle: 'Viaje' }],
      },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-10-05', hasta: '2026-10-19' },
      reloj,
    )

    expect(ocurrencias.map((o) => [o.fecha, o.estado])).toEqual([
      ['2026-10-05', 'AGENDADO'],
      ['2026-10-12', 'CANCELADO'],
      ['2026-10-19', 'AGENDADO'],
    ])
    expect(ocurrencias[1]?.cancelacion).toEqual({
      motivo: 'OTRO',
      detalle: 'Viaje',
      createdById: 'usr_mesa',
      createdAt: '2026-09-20T12:00:00.000Z',
    })
    expect(ocurrencias[0]).not.toHaveProperty('cancelacion')
  })

  it('pago: PAGADO con pagoId e importeAplicado (número); sin pago, PENDIENTE', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-05',
        fechaFin: null,
        pagos: [{ fecha: '2026-10-12', pagoId: 8, importe: 8000.5 }],
      },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-10-05', hasta: '2026-10-12' },
      reloj,
    )

    expect(ocurrencias.map((o) => o.pago)).toEqual([
      { estado: 'PENDIENTE' },
      { estado: 'PAGADO', pagoId: 8, importeAplicado: 8000.5 },
    ])
  })

  it('finalización con fechaFin nula: corta el día anterior a fechaDesde', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        finalizadaDesde: '2026-10-19',
      },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-09-28', hasta: '2026-11-02' },
      reloj,
    )

    expect(ocurrencias.map((o) => o.fecha)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(ocurrencias[0]?.serie).toEqual({
      fechaInicio: '2026-09-28',
      fechaFin: null,
      finEfectivo: '2026-10-18',
    })
  })

  it('finalización con fechaFin anterior a fechaDesde: manda fechaFin', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-10-05',
        finalizadaDesde: '2026-10-26',
      },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-09-28', hasta: '2026-11-02' },
      reloj,
    )

    expect(ocurrencias.map((o) => o.fecha)).toEqual(['2026-09-28', '2026-10-05'])
    expect(ocurrencias[0]?.serie.finEfectivo).toBe('2026-10-05')
  })

  it('SIN_REGISTRAR con reloj fijo: ayer SIN_REGISTRAR, hoy AGENDADO, pasada cancelada CANCELADO', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 30, fechaInicio: '2026-10-04', fechaFin: '2026-10-04' }, // ayer
      { id: 2, bloqueAgendaId: 10, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' }, // hoy
      {
        id: 3,
        bloqueAgendaId: 11,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        cancelaciones: [{ fecha: '2026-09-28' }],
      },
    ]

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-09-28', hasta: '2026-10-05' },
      reloj,
    )

    expect(ocurrencias.map((o) => [o.turnoId, o.estado])).toEqual([
      [3, 'CANCELADO'],
      [1, 'SIN_REGISTRAR'],
      [2, 'AGENDADO'],
    ])
  })

  it('filtros: alumnoId, profesorId (por el bloque) y turnoIds; un turno CANCELADO legado no aparece', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, alumnoId: 12, fechaInicio: '2026-10-05', fechaFin: null },
      { id: 2, bloqueAgendaId: 20, alumnoId: 13, fechaInicio: '2026-10-05', fechaFin: null },
      { id: 3, bloqueAgendaId: 11, alumnoId: 12, fechaInicio: '2026-10-05', fechaFin: null },
      {
        id: 4,
        bloqueAgendaId: 10,
        alumnoId: 12,
        estado: 'CANCELADO',
        fechaInicio: '2026-10-05',
        fechaFin: null,
      },
    ]
    const rango = { desde: '2026-10-05', hasta: '2026-10-05' }

    const delAlumno = await leerOcurrencias(cliente(), { ...rango, alumnoId: 13 }, reloj)
    expect(delAlumno.map((o) => o.turnoId)).toEqual([2])

    const delProfesor = await leerOcurrencias(cliente(), { ...rango, profesorId: 4 }, reloj)
    expect(delProfesor.map((o) => o.turnoId)).toEqual([1, 3])

    const porIds = await leerOcurrencias(cliente(), { ...rango, turnoIds: [3, 4] }, reloj)
    expect(porIds.map((o) => o.turnoId)).toEqual([3])
  })

  it('una cantidad fija de consultas: no crece con la cantidad de turnos', async () => {
    const rango = { desde: '2026-09-28', hasta: '2026-10-26' }
    turnos = [{ id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null }]
    await leerOcurrencias(cliente(), rango, reloj)
    const conUno = base.findMany.mock.calls.length

    turnos = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      bloqueAgendaId: i % 2 === 0 ? 10 : 20,
      fechaInicio: '2026-09-28',
      fechaFin: null,
      cancelaciones: [{ fecha: '2026-10-05' }],
      pagos: [{ fecha: '2026-09-28', pagoId: i + 1, importe: 100 }],
    }))
    const ocurrencias = await leerOcurrencias(cliente(), rango, reloj)

    expect(conUno).toBe(1)
    expect(base.findMany).toHaveBeenCalledTimes(1)
    expect(ocurrencias).toHaveLength(150)
  })

  it('el prefiltro de la base pide los turnos ACTIVO que se cruzan con el rango, en el día del rango', async () => {
    await leerOcurrencias(cliente(), { desde: '2026-10-05', hasta: '2026-10-05', aulaId: 1 }, reloj)

    expect(base.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          estado: 'ACTIVO',
          fechaInicio: { lte: new Date('2026-10-05T00:00:00.000Z') },
          OR: [{ fechaFin: null }, { fechaFin: { gte: new Date('2026-10-05T00:00:00.000Z') } }],
          bloqueAgenda: { aulaId: 1, diaSemana: { in: [1] } },
        },
      }),
    )
  })
})

// ---------------------------------------------------------------------------------------------
// ocupacionEn / ocupacionesEn
// ---------------------------------------------------------------------------------------------

describe('ocupacionEn y ocupacionesEn', () => {
  beforeEach(() => {
    turnos = [
      { id: 1, bloqueAgendaId: 10, fechaInicio: '2026-09-28', fechaFin: null },
      {
        id: 2,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-10-12' }],
      },
      {
        id: 3,
        bloqueAgendaId: 10,
        fechaInicio: '2026-09-28',
        fechaFin: null,
        finalizadaDesde: '2026-10-19',
      },
      {
        id: 4,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-12',
        pagos: [{ fecha: '2026-10-12', pagoId: 1, importe: 10 }],
      },
    ]
  })

  it('una cancelación libera su lugar; una pagada ocupa lugar igual', async () => {
    // 12/10: 1, 3 y 4 (pagada); 2 está cancelada.
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 10, fecha: '2026-10-12' })).toBe(3)
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 10, fecha: '2026-10-05' })).toBe(3)
  })

  it('un turno finalizado deja de ocupar lugar desde fechaDesde', async () => {
    // 19/10: 1 y 2; 3 está finalizada desde el 19/10.
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 10, fecha: '2026-10-19' })).toBe(2)
  })

  it('excluir saca esa ocurrencia puntual y no otra fecha del mismo turno', async () => {
    const excluir = { turnoId: 1, fecha: '2026-10-05' }
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 10, fecha: '2026-10-05', excluir })).toBe(
      2,
    )
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 10, fecha: '2026-10-19', excluir })).toBe(
      2,
    )
  })

  it('el lote responde cada par en una sola consulta (0 si nadie ocupa lugar)', async () => {
    const ocupacion = await ocupacionesEn(cliente(), [
      { bloqueAgendaId: 10, fecha: '2026-10-05' },
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
      { bloqueAgendaId: 10, fecha: '2026-10-19' },
      { bloqueAgendaId: 20, fecha: '2026-10-19' },
    ])

    expect(base.findMany).toHaveBeenCalledTimes(1)
    expect(Object.fromEntries(ocupacion)).toEqual({
      [claveOcupacion(10, '2026-10-05')]: 3,
      [claveOcupacion(10, '2026-10-12')]: 3,
      [claveOcupacion(10, '2026-10-19')]: 2,
      [claveOcupacion(20, '2026-10-19')]: 0,
    })
  })

  it('sin consultas no va a la base', async () => {
    expect((await ocupacionesEn(cliente(), [])).size).toBe(0)
    expect(base.findMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
// superposicionesDelAlumno
// ---------------------------------------------------------------------------------------------

describe('superposicionesDelAlumno', () => {
  const nueveADiez = { alumnoId: 12, horaInicio: 540, horaFin: 600 }

  it('fecha única: las ocurrencias no canceladas del alumno que se pisan, de cualquier profesor', async () => {
    turnos = [
      { id: 1, bloqueAgendaId: 20, fechaInicio: '2026-09-28', fechaFin: null }, // Juan 9–10
      { id: 2, bloqueAgendaId: 11, fechaInicio: '2026-09-28', fechaFin: null }, // 10–11: no pisa
      { id: 3, bloqueAgendaId: 10, alumnoId: 13, fechaInicio: '2026-09-28', fechaFin: null },
      {
        id: 4,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
        cancelaciones: [{ fecha: '2026-10-05' }],
      },
    ]

    const choques = await superposicionesDelAlumno(
      cliente(),
      { ...nueveADiez, fecha: '2026-10-05' },
      reloj,
    )

    expect(fechasDe(choques)).toEqual([[1, '2026-10-05']])
  })

  it('con hasta en una serie sin fin que choca después de una cancelación: devuelve la primera fecha real', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 20,
        fechaInicio: '2026-10-05',
        fechaFin: null,
        cancelaciones: [{ fecha: '2026-10-05' }, { fecha: '2026-10-12' }],
      },
    ]

    const choques = await superposicionesDelAlumno(
      cliente(),
      { ...nueveADiez, fecha: '2026-10-05', hasta: null },
      reloj,
    )

    expect(fechasDe(choques)).toEqual([[1, '2026-10-19']])
    expect(choques[0]?.serie).toEqual({
      fechaInicio: '2026-10-05',
      fechaFin: null,
      finEfectivo: null,
    })
  })

  it('sin choque porque la otra serie está finalizada antes del pedido', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 20,
        fechaInicio: '2026-09-07',
        fechaFin: null,
        finalizadaDesde: '2026-10-05',
      },
    ]

    const choques = await superposicionesDelAlumno(
      cliente(),
      { ...nueveADiez, fecha: '2026-10-05', hasta: null },
      reloj,
    )

    expect(choques).toEqual([])
  })

  it('excluir saca la propia ocurrencia (reprogramación)', async () => {
    turnos = [{ id: 1, bloqueAgendaId: 20, fechaInicio: '2026-10-05', fechaFin: '2026-10-05' }]

    const choques = await superposicionesDelAlumno(
      cliente(),
      { ...nueveADiez, fecha: '2026-10-05', excluir: { turnoId: 1, fecha: '2026-10-05' } },
      reloj,
    )

    expect(choques).toEqual([])
  })

  it('pide a la base sólo el día y las horas que se pisan con el pedido', async () => {
    await superposicionesDelAlumno(cliente(), { ...nueveADiez, fecha: '2026-10-05' }, reloj)

    expect(base.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          alumnoId: 12,
          bloqueAgenda: { diaSemana: { in: [1] }, horaInicio: { lt: 600 }, horaFin: { gt: 540 } },
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------------------------
// bloquearParaReserva y materiasDelProfesorConAlumno
// ---------------------------------------------------------------------------------------------

describe('bloquearParaReserva', () => {
  it('toma los tres locks en orden (profesor, filas por id, alumno), con los ids ordenados y como parámetros', async () => {
    await bloquearParaReserva(cliente(), {
      profesorId: 4,
      bloqueAgendaIds: [11, 10, 11],
      alumnoId: 12,
    })

    expect(queryRaw).toHaveBeenCalledTimes(3)
    const [profesor, filas, alumno] = queryRaw.mock.calls.map(([partes, ...valores]) => ({
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
})

describe('bloquearAlumno', () => {
  it('toma sólo el lock del alumno (FOR UPDATE), con el id como parámetro', async () => {
    await bloquearAlumno(cliente(), 12)

    expect(queryRaw).toHaveBeenCalledTimes(1)
    const [partes, ...valores] = queryRaw.mock.calls[0] as [string[], ...unknown[]]
    expect(partes.join('?')).toBe('SELECT id FROM alumno WHERE id = ? FOR UPDATE')
    expect(valores).toEqual([12])
  })
})

describe('materiasDelProfesorConAlumno', () => {
  it('materias de los turnos ACTIVO del alumno en bloques del profesor, sin repetir y por nombre', async () => {
    materiaFindMany.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    const materias = await materiasDelProfesorConAlumno(cliente(), { profesorId: 4, alumnoId: 12 })

    expect(materias).toEqual([{ id: 3, nombre: 'Matemática' }])
    expect(materiaFindMany).toHaveBeenCalledWith({
      where: {
        turnos: { some: { estado: 'ACTIVO', alumnoId: 12, bloqueAgenda: { profesorId: 4 } } },
      },
      select: { id: true, nombre: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
    })
  })
})
