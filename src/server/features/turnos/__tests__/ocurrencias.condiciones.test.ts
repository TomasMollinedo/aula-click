import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bloquearAlumno,
  bloquearParaReserva,
  claveOcupacion,
  leerFilasDeLaSerie,
  leerOcurrencias,
  materiasDelProfesorConAlumno,
  ocupacionEn,
  ocupacionesEn,
  superposicionesDelAlumno,
  type ClienteOcurrencias,
} from '../ocurrencias.condiciones'
import {
  crearTurnosEnMemoria,
  d,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from './turnos-en-memoria'

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
      asistencia: null,
      plazoAsistencia: { vence: '2026-10-12', vencido: false },
      serie: { serieId: null, fechaInicio: '2026-10-05', fechaFin: null, finEfectivo: null },
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
      serieId: null,
      fechaInicio: '2026-09-28',
      fechaFin: null,
      finEfectivo: '2026-10-18',
    })
  })

  it('expone el serieId de la fila: los tramos y las horas de un alta lo comparten (T-103)', async () => {
    const SERIE = '11111111-1111-4111-8111-111111111111'
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        serieId: SERIE,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
      },
      { id: 2, bloqueAgendaId: 10, serieId: SERIE, fechaInicio: '2026-10-19', fechaFin: null },
      { id: 3, bloqueAgendaId: 11, serieId: SERIE, fechaInicio: '2026-10-05', fechaFin: null },
      { id: 4, bloqueAgendaId: 20, fechaInicio: '2026-10-05', fechaFin: null }, // sin serie
    ]
    turnos[0] = { ...turnos[0], tipo: 'RECURRENTE' } as TurnoDePrueba

    const ocurrencias = await leerOcurrencias(
      cliente(),
      { desde: '2026-10-05', hasta: '2026-10-19' },
      reloj,
    )

    const porTurno = new Map(ocurrencias.map((o) => [o.turnoId, o.serie.serieId]))
    expect([...porTurno]).toEqual([
      [1, SERIE],
      [4, null],
      [3, SERIE],
      [2, SERIE],
    ])
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

  it('pago anulado (vigente: false) solo: PENDIENTE', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 10,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
        pagos: [{ fecha: '2026-10-05', pagoId: 8, importe: 8000, vigente: false }],
      },
    ]

    const [ocurrencia] = await leerOcurrencias(
      cliente(),
      { desde: '2026-10-05', hasta: '2026-10-05' },
      reloj,
    )

    expect(ocurrencia?.pago).toEqual({ estado: 'PENDIENTE' })
  })

  it.each([
    ['anulado primero', [false, true]],
    ['vigente primero', [true, false]],
  ])(
    'un pago anulado y uno vigente (%s): PAGADO con el pagoId del vigente',
    async (_, vigencias) => {
      turnos = [
        {
          id: 1,
          bloqueAgendaId: 10,
          fechaInicio: '2026-10-05',
          fechaFin: '2026-10-05',
          pagos: vigencias.map((vigente) => ({
            fecha: '2026-10-05',
            pagoId: vigente ? 9 : 8,
            importe: vigente ? 9000 : 8000,
            vigente,
          })),
        },
      ]

      const [ocurrencia] = await leerOcurrencias(
        cliente(),
        { desde: '2026-10-05', hasta: '2026-10-05' },
        reloj,
      )

      expect(ocurrencia?.pago).toEqual({ estado: 'PAGADO', pagoId: 9, importeAplicado: 9000 })
    },
  )

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
// leerOcurrencias: asistencia y plazo (T-74)
// ---------------------------------------------------------------------------------------------

describe('leerOcurrencias: asistencia y plazo', () => {
  /** Un turno semanal de los lunes 9–10 desde el 28/09. */
  const semanal = (datos: Partial<TurnoDePrueba> = {}): TurnoDePrueba => ({
    id: 1,
    bloqueAgendaId: 10,
    fechaInicio: '2026-09-28',
    fechaFin: null,
    ...datos,
  })
  const leer = (desde: string, hasta: string, conReloj: () => Date = reloj) =>
    leerOcurrencias(cliente(), { desde, hasta }, conReloj)

  it('presente → REALIZADO, con la asistencia completa (fechas en ISO)', async () => {
    turnos = [
      semanal({
        asistencias: [
          {
            fecha: '2026-09-28',
            estado: 'PRESENTE',
            trabajado: 'Ecuaciones',
            indicaciones: 'Repasar fracciones',
          },
        ],
      }),
    ]

    const [ocurrencia] = await leer('2026-09-28', '2026-09-28')

    expect(ocurrencia?.estado).toBe('REALIZADO')
    expect(ocurrencia?.asistencia).toEqual({
      estado: 'PRESENTE',
      trabajado: 'Ecuaciones',
      indicaciones: 'Repasar fracciones',
      observacion: null,
      createdById: 'usr_profe',
      createdAt: '2026-10-05T18:00:00.000Z',
      updatedById: 'usr_profe',
      updatedAt: '2026-10-05T18:30:00.000Z',
    })
    expect(ocurrencia?.plazoAsistencia).toEqual({ vence: '2026-10-05', vencido: false })
  })

  it('ausente → AUSENTE, con su observación', async () => {
    turnos = [
      semanal({
        asistencias: [{ fecha: '2026-09-28', estado: 'AUSENTE', observacion: 'Avisó tarde' }],
      }),
    ]

    const [ocurrencia] = await leer('2026-09-28', '2026-09-28')

    expect(ocurrencia?.estado).toBe('AUSENTE')
    expect(ocurrencia?.asistencia).toMatchObject({
      estado: 'AUSENTE',
      trabajado: null,
      indicaciones: null,
      observacion: 'Avisó tarde',
    })
  })

  it('cancelada con asistencia → CANCELADO y sin plazo (la asistencia se expone igual)', async () => {
    turnos = [
      semanal({
        cancelaciones: [{ fecha: '2026-09-28' }],
        asistencias: [{ fecha: '2026-09-28', estado: 'PRESENTE' }],
      }),
    ]

    const [ocurrencia] = await leer('2026-09-28', '2026-09-28')

    expect(ocurrencia?.estado).toBe('CANCELADO')
    expect(ocurrencia?.plazoAsistencia).toBeNull()
    expect(ocurrencia?.asistencia).toMatchObject({ estado: 'PRESENTE' })
  })

  it('futura: AGENDADO, sin asistencia y sin plazo; la de hoy sí tiene plazo', async () => {
    turnos = [semanal()]

    const ocurrencias = await leer('2026-10-05', '2026-10-12')

    expect(ocurrencias.map((o) => [o.fecha, o.estado, o.asistencia, o.plazoAsistencia])).toEqual([
      ['2026-10-05', 'AGENDADO', null, { vence: '2026-10-12', vencido: false }],
      ['2026-10-12', 'AGENDADO', null, null],
    ])
  })

  it('plazo de un turno del 28/09: con el reloj del 05/10 (día 7) en plazo; con el del 06/10, vencido', async () => {
    turnos = [semanal()]

    const [dia7] = await leer('2026-09-28', '2026-09-28')
    const [dia8] = await leer('2026-09-28', '2026-09-28', () => new Date('2026-10-06T15:00:00Z'))

    expect(dia7?.plazoAsistencia).toEqual({ vence: '2026-10-05', vencido: false })
    expect(dia7?.estado).toBe('SIN_REGISTRAR')
    expect(dia8?.plazoAsistencia).toEqual({ vence: '2026-10-05', vencido: true })
    expect(dia8?.estado).toBe('SIN_REGISTRAR')
    expect(dia8?.asistencia).toBeNull()
  })

  it('el borde de las 23:59 en Salta: sólo cambia el reloj, sin proceso programado', async () => {
    turnos = [semanal()]

    // 2026-10-06T02:59Z = 05/10 23:59 en Salta (UTC-3): último minuto del día 7.
    const [ultimoMinuto] = await leer(
      '2026-09-28',
      '2026-09-28',
      () => new Date('2026-10-06T02:59:00Z'),
    )
    // 2026-10-06T03:00Z = 06/10 00:00 en Salta: día 8.
    const [medianoche] = await leer(
      '2026-09-28',
      '2026-09-28',
      () => new Date('2026-10-06T03:00:00Z'),
    )

    expect(ultimoMinuto?.plazoAsistencia?.vencido).toBe(false)
    expect(medianoche?.plazoAsistencia?.vencido).toBe(true)
  })

  it('una asistencia fuera del rango no aparece; una sola consulta, con las asistencias del rango', async () => {
    turnos = [
      semanal({
        asistencias: [
          { fecha: '2026-09-28', estado: 'PRESENTE' },
          { fecha: '2026-10-05', estado: 'AUSENTE' },
        ],
      }),
    ]

    const ocurrencias = await leer('2026-10-05', '2026-10-05')

    expect(ocurrencias.map((o) => [o.fecha, o.estado, o.asistencia?.estado])).toEqual([
      ['2026-10-05', 'AUSENTE', 'AUSENTE'],
    ])
    expect(base.findMany).toHaveBeenCalledTimes(1)
    const rango = {
      gte: new Date('2026-10-05T00:00:00.000Z'),
      lte: new Date('2026-10-05T00:00:00.000Z'),
    }
    expect(base.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          asistencias: expect.objectContaining({ where: { fechaOcurrencia: rango } }),
          pagoTurnos: expect.objectContaining({ where: { fechaOcurrencia: rango, vigente: true } }),
        }),
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

  it('una ocurrencia REALIZADO y una AUSENTE ocupan lugar como cualquier no cancelada', async () => {
    turnos = [
      {
        id: 1,
        bloqueAgendaId: 20,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        asistencias: [{ fecha: '2026-09-28', estado: 'PRESENTE' }],
      },
      {
        id: 2,
        bloqueAgendaId: 20,
        fechaInicio: '2026-09-28',
        fechaFin: '2026-09-28',
        asistencias: [{ fecha: '2026-09-28', estado: 'AUSENTE' }],
      },
    ]

    const estados = await leerOcurrencias(
      cliente(),
      { desde: '2026-09-28', hasta: '2026-09-28', bloqueAgendaIds: [20] },
      reloj,
    )
    expect(estados.map((o) => o.estado)).toEqual(['REALIZADO', 'AUSENTE'])
    expect(await ocupacionEn(cliente(), { bloqueAgendaId: 20, fecha: '2026-09-28' })).toBe(2)
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
      serieId: null,
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

describe('leerFilasDeLaSerie', () => {
  const SERIE = '11111111-1111-4111-8111-111111111111'
  const findUnique = vi.fn()
  const findMany = vi.fn()
  const clienteDeFilas = () =>
    ({ turno: { findUnique, findMany } }) as unknown as ClienteOcurrencias

  /** Una fila `turno` como la devuelve Prisma con el select de la lectura. */
  const fila = (parcial: Record<string, unknown> = {}) => ({
    id: 41,
    serieId: SERIE,
    bloqueAgendaId: 10,
    alumnoId: 12,
    tipo: 'RECURRENTE',
    estado: 'ACTIVO',
    fechaInicio: d('2026-10-05'),
    fechaFin: d('2026-10-19'),
    bloqueAgenda: { diaSemana: 1, horaInicio: 540, horaFin: 600 },
    finalizacion: null,
    ...parcial,
  })

  beforeEach(() => {
    findUnique.mockReset()
    findMany.mockReset()
  })

  it('turno inexistente: null, sin más consultas', async () => {
    findUnique.mockResolvedValue(null)

    expect(await leerFilasDeLaSerie(clienteDeFilas(), 99)).toBeNull()
    expect(findMany).not.toHaveBeenCalled()
  })

  it('con serieId: el turno y los RECURRENTE ACTIVO de su serie (todas sus horas y tramos)', async () => {
    findUnique.mockResolvedValue(fila())
    findMany.mockResolvedValue([
      fila(),
      fila({
        id: 58,
        fechaInicio: d('2026-11-02'),
        fechaFin: null,
        finalizacion: { fechaDesde: d('2026-11-16') },
      }),
      fila({
        id: 42,
        bloqueAgendaId: 11,
        bloqueAgenda: { diaSemana: 1, horaInicio: 600, horaFin: 660 },
      }),
    ])

    const serie = await leerFilasDeLaSerie(clienteDeFilas(), 41)

    expect(findUnique.mock.calls[0]?.[0].where).toEqual({ id: 41 })
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { serieId: SERIE, tipo: 'RECURRENTE', estado: 'ACTIVO' },
      orderBy: [{ bloqueAgenda: { horaInicio: 'asc' } }, { fechaInicio: 'asc' }, { id: 'asc' }],
    })
    expect(serie?.turno).toEqual({
      turnoId: 41,
      serieId: SERIE,
      bloqueAgendaId: 10,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      activo: true,
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-19',
      diaSemana: 1,
      horaInicio: 540,
      horaFin: 600,
      finalizadaDesde: null,
    })
    expect(
      serie?.filas.map((f) => [f.turnoId, f.bloqueAgendaId, f.fechaFin, f.finalizadaDesde]),
    ).toEqual([
      [41, 10, '2026-10-19', null],
      [58, 10, null, '2026-11-16'],
      [42, 11, '2026-10-19', null],
    ])
  })

  it('serieId nulo: la serie es sólo ese turno, en una sola consulta', async () => {
    findUnique.mockResolvedValue(fila({ serieId: null }))

    const serie = await leerFilasDeLaSerie(clienteDeFilas(), 41)

    expect(serie?.filas).toEqual([serie?.turno])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('una sesión única, o un turno CANCELADO, sin serieId: se devuelve el turno y ninguna fila', async () => {
    findUnique.mockResolvedValue(fila({ serieId: null, tipo: 'SESION_UNICA' }))
    expect(await leerFilasDeLaSerie(clienteDeFilas(), 41)).toMatchObject({
      turno: { tipo: 'SESION_UNICA' },
      filas: [],
    })

    findUnique.mockResolvedValue(fila({ serieId: null, estado: 'CANCELADO' }))
    expect(await leerFilasDeLaSerie(clienteDeFilas(), 41)).toMatchObject({
      turno: { activo: false },
      filas: [],
    })
  })
})
