import { describe, expect, it } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  armarPrevia,
  planificarFinalizacion,
  validarFinalizacion,
  type FilaDeSerie,
  type OcurrenciaDeLaSerie,
  type SnapshotFinalizacion,
} from '../finalizaciones.reglas'
import { semanales } from './finalizaciones-en-memoria'

// Reglas puras de la finalización (T-47; por hora, decisión T-104). Hoy es el lunes 05/10/2026; el
// turno 41 es el de los lunes de 9 a 10, del 05/10 al 30/11 (9 fechas).

const HOY = '2026-10-05'
const SERIE = '11111111-1111-4111-8111-111111111111'

function fila(parcial: Partial<FilaDeSerie> = {}): FilaDeSerie {
  return {
    turnoId: 41,
    serieId: null,
    bloqueAgendaId: 7,
    alumnoId: 12,
    tipo: 'RECURRENTE',
    activo: true,
    fechaInicio: '2026-10-05',
    fechaFin: '2026-11-30',
    diaSemana: 1,
    horaInicio: 540,
    horaFin: 600,
    finalizadaDesde: null,
    ...parcial,
  }
}

/** Snapshot de un turno sin `serieId`: su serie es sólo él (si es `RECURRENTE` `ACTIVO`). */
function snapshot(
  turno: FilaDeSerie = fila(),
  ocurrencias: OcurrenciaDeLaSerie[] = semanales('2026-10-05', '2026-11-30'),
): SnapshotFinalizacion {
  return {
    turno,
    filas: turno.tipo === 'RECURRENTE' && turno.activo ? [turno] : [],
    ocurrencias,
  }
}

/**
 * La serie de un alta de dos horas, lunes de 9 a 11, del 05/10 al 30/11, con el 26/10 lleno en la
 * hora de 9: la de 9 quedó en dos tramos (41: 05/10–19/10 y 58: 02/11–30/11) y la de 10, entera
 * (42). Las ocurrencias, desde `desde` (como las lee el repository: `max(hoy, fechaDesde)`).
 */
const tramoA = fila({ serieId: SERIE, fechaFin: '2026-10-19' })
const tramoB = fila({ turnoId: 58, serieId: SERIE, fechaInicio: '2026-11-02' })
const horaDe10 = fila({
  turnoId: 42,
  serieId: SERIE,
  bloqueAgendaId: 8,
  horaInicio: 600,
  horaFin: 660,
})

function serieDeDosHoras(
  desde: string,
  cambios: { filas?: FilaDeSerie[]; turno?: FilaDeSerie } = {},
): SnapshotFinalizacion {
  const filas = cambios.filas ?? [tramoA, tramoB, horaDe10]
  const todas = [
    ...semanales('2026-10-05', '2026-10-19', 41),
    ...semanales('2026-11-02', '2026-11-30', 58),
    ...semanales('2026-10-05', '2026-11-30', 42, 600),
  ]
  const ids = new Set(filas.map((f) => f.turnoId))
  return {
    turno: cambios.turno ?? tramoA,
    filas,
    ocurrencias: todas
      .filter((o) => ids.has(o.turnoId) && o.fecha >= desde)
      .sort((a, b) =>
        a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.horaInicio - b.horaInicio,
      ),
  }
}

function con(
  ocurrencias: OcurrenciaDeLaSerie[],
  cambios: Record<string, Partial<OcurrenciaDeLaSerie>>,
): OcurrenciaDeLaSerie[] {
  return ocurrencias.map((o) => ({ ...o, ...cambios[o.fecha] }))
}

const pagada = (importe: number): Partial<OcurrenciaDeLaSerie> => ({
  pago: { estado: 'PAGADO', importeAplicado: importe },
})

function errorDe(fn: () => unknown): AppError {
  try {
    fn()
  } catch (error) {
    return error as AppError
  }
  throw new Error('Debía fallar')
}

/** `armarPrevia` sobre el conjunto que valida `validarFinalizacion`. */
function previaDe(s: SnapshotFinalizacion, fechaDesde: string) {
  return armarPrevia(s, validarFinalizacion(s, fechaDesde, HOY), fechaDesde)
}

describe('validarFinalizacion', () => {
  it('pedido válido: devuelve el conjunto (sin serieId, sólo el turno)', () => {
    expect(validarFinalizacion(snapshot(), '2026-10-19', HOY)).toEqual({
      turno: fila(),
      filas: [fila()],
      primerInicio: '2026-10-05',
      ultimoFin: '2026-11-30',
    })
  })

  it('turno inexistente → 404', () => {
    const s = { turno: null, filas: [], ocurrencias: [] }
    const error = errorDe(() => validarFinalizacion(s, '2026-10-19', HOY))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Turno no encontrado')
  })

  it.each([
    [
      'sesión única',
      fila({ tipo: 'SESION_UNICA', fechaFin: '2026-10-05' }),
      'Sólo se puede finalizar un turno recurrente',
    ],
    [
      'Turno.estado = CANCELADO',
      fila({ activo: false }),
      'El turno ya no está vigente: no se puede finalizar',
    ],
    [
      'fechaFin anterior a hoy',
      fila({ fechaInicio: '2026-09-07', fechaFin: '2026-09-28' }),
      'El turno ya no está vigente: no se puede finalizar',
    ],
    ['ya finalizado', fila({ finalizadaDesde: '2026-11-02' }), 'El turno ya fue finalizado'],
  ])('%s → 409 CONFLICTO', (_, t, mensaje) => {
    const error = errorDe(() => validarFinalizacion(snapshot(t), '2026-10-19', HOY))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('CONFLICTO')
    expect(error.message).toBe(mensaje)
  })

  it('una serie que termina hoy sigue vigente (mismo criterio que el botón de T-43)', () => {
    const t = fila({ fechaInicio: '2026-09-28', fechaFin: HOY })

    expect(validarFinalizacion(snapshot(t), HOY, HOY).turno).toEqual(t)
  })

  it.each([
    ['anterior a hoy', '2026-09-28', 'La fecha no puede ser anterior a hoy'],
    ['en otro día de la semana', '2026-10-20', 'La fecha debe caer en lunes'],
    [
      'igual a fechaInicio',
      '2026-10-05',
      'Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno.',
    ],
    ['posterior al fin', '2026-12-07', 'La fecha es posterior al fin del turno (30/11)'],
  ])('fechaDesde %s → 400 en fechaDesde', (_, fechaDesde, mensaje) => {
    const t = fila({ fechaInicio: fechaDesde < HOY ? '2026-09-21' : '2026-10-05' })
    const error = errorDe(() => validarFinalizacion(snapshot(t), fechaDesde, HOY))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe(mensaje)
    expect(error.details).toEqual([{ path: ['fechaDesde'], message: mensaje }])
  })

  it('el 409 del turno gana sobre el 400 de la fecha', () => {
    const s = snapshot(fila({ finalizadaDesde: '2026-11-02' }))

    expect(errorDe(() => validarFinalizacion(s, '2026-10-20', HOY))).toBeInstanceOf(ConflictError)
  })
})

describe('validarFinalizacion: el conjunto de una serie (misma hora, todos sus tramos)', () => {
  it('el conjunto son los tramos de la hora del turno pedido, sin la otra hora', () => {
    const conjunto = validarFinalizacion(serieDeDosHoras('2026-10-12'), '2026-10-12', HOY)

    expect(conjunto.filas.map((f) => f.turnoId)).toEqual([41, 58])
    expect(conjunto).toMatchObject({ primerInicio: '2026-10-05', ultimoFin: '2026-11-30' })
  })

  it('un tramo sin fin: el conjunto no tiene último fin', () => {
    const s = serieDeDosHoras('2026-10-12', {
      filas: [tramoA, { ...tramoB, fechaFin: null }, horaDe10],
    })

    expect(validarFinalizacion(s, '2027-03-01', HOY).ultimoFin).toBeNull()
  })

  it.each([
    ['en el primer tramo', '2026-10-12'],
    ['en el hueco entre los dos tramos', '2026-10-26'],
    ['igual al inicio del último tramo (posterior al primer inicio)', '2026-11-02'],
    ['en el último tramo', '2026-11-16'],
    ['igual al último fin', '2026-11-30'],
  ])('fechaDesde %s es válida', (_, fechaDesde) => {
    expect(() => validarFinalizacion(serieDeDosHoras(fechaDesde), fechaDesde, HOY)).not.toThrow()
  })

  it('los extremos son los del conjunto: primer inicio y último fin', () => {
    const desdeB = { turno: tramoB }
    expect(
      errorDe(() => validarFinalizacion(serieDeDosHoras(HOY, desdeB), '2026-10-05', HOY)).message,
    ).toBe(
      'Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno.',
    )
    expect(
      errorDe(() => validarFinalizacion(serieDeDosHoras('2026-12-07'), '2026-12-07', HOY)).message,
    ).toBe('La fecha es posterior al fin del turno (30/11)')
  })

  it('un tramo de la hora ya finalizado → 409, se pida desde el tramo que se pida', () => {
    const filas = [tramoA, { ...tramoB, finalizadaDesde: '2026-11-16' }, horaDe10]

    for (const turno of [tramoA, filas[1]]) {
      const s = serieDeDosHoras('2026-10-12', { filas, turno })
      expect(errorDe(() => validarFinalizacion(s, '2026-10-12', HOY)).message).toBe(
        'El turno ya fue finalizado',
      )
    }
  })

  it('la finalización de la otra hora no impide finalizar esta', () => {
    const filas = [tramoA, tramoB, { ...horaDe10, finalizadaDesde: '2026-10-12' }]

    expect(() =>
      validarFinalizacion(serieDeDosHoras('2026-10-12', { filas }), '2026-10-12', HOY),
    ).not.toThrow()
  })

  it('vigente es del conjunto: desde un tramo ya terminado, si otro tramo de la hora sigue', () => {
    const pasado = fila({ serieId: SERIE, fechaInicio: '2026-09-07', fechaFin: '2026-09-21' })
    const s = { turno: pasado, filas: [pasado, tramoB], ocurrencias: [] }

    expect(validarFinalizacion(s, '2026-11-09', HOY).filas.map((f) => f.turnoId)).toEqual([41, 58])
  })
})

describe('armarPrevia', () => {
  it('con fin: cantidad y rango hasta la última ocurrencia', () => {
    expect(previaDe(snapshot(), '2026-10-19')).toEqual({
      cantidad: 7,
      desde: '2026-10-19',
      hasta: '2026-11-30',
      pagadas: [],
      ultimaFechaPagada: null,
      fechaDesdeMinima: null,
      otrasHoras: [],
    })
  })

  it('hasta es la última ocurrencia, no la fechaFin cruda', () => {
    expect(previaDe(snapshot(fila({ fechaFin: '2026-12-03' })), '2026-10-19')).toMatchObject({
      cantidad: 7,
      hasta: '2026-11-30',
    })
  })

  it('sin fin: cantidad y hasta en null', () => {
    const s = snapshot(fila({ fechaFin: null }), semanales('2026-10-05', '2026-10-19'))

    expect(previaDe(s, '2026-10-19')).toMatchObject({
      cantidad: null,
      desde: '2026-10-19',
      hasta: null,
    })
  })

  it('una cancelada en el medio no cuenta', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), { '2026-11-02': { estado: 'CANCELADO' } }),
    )

    expect(previaDe(s, '2026-10-19')).toMatchObject({ cantidad: 6, hasta: '2026-11-30' })
  })

  it('pagadas desde fechaDesde: lista, última fecha y fecha mínima (las anteriores no cuentan)', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), {
        '2026-10-12': pagada(8000),
        '2026-10-26': pagada(8500),
        '2026-11-16': pagada(9000.5),
      }),
    )

    expect(previaDe(s, '2026-10-19')).toMatchObject({
      cantidad: 7,
      pagadas: [
        { fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
        { fecha: '2026-11-16', horaInicio: '09:00', horaFin: '10:00', importe: 9000.5 },
      ],
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
    })
  })

  it('pagada la última de la serie: fechaDesdeMinima null', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), { '2026-11-30': pagada(8500) }),
    )

    expect(previaDe(s, '2026-10-19')).toMatchObject({
      ultimaFechaPagada: '2026-11-30',
      fechaDesdeMinima: null,
    })
  })

  it('sin fin, con pagadas: siempre hay fecha mínima', () => {
    const s = snapshot(
      fila({ fechaFin: null }),
      con(semanales('2026-10-05', '2026-11-09'), { '2026-11-09': pagada(8500) }),
    )

    expect(previaDe(s, '2026-10-19')).toMatchObject({
      cantidad: null,
      ultimaFechaPagada: '2026-11-09',
      fechaDesdeMinima: '2026-11-16',
    })
  })
})

describe('armarPrevia: una serie de dos horas con tramos', () => {
  it('cantidad y hasta cuentan todos los tramos de la hora, no la otra hora', () => {
    // 12/10 y 19/10 del primer tramo + 02/11 a 30/11 del segundo; el 26/10 no tiene turno.
    expect(previaDe(serieDeDosHoras('2026-10-12'), '2026-10-12')).toMatchObject({
      cantidad: 7,
      desde: '2026-10-12',
      hasta: '2026-11-30',
      pagadas: [],
    })
  })

  it('otrasHoras: la otra hora de la serie, con su primera ocurrencia desde fechaDesde', () => {
    expect(previaDe(serieDeDosHoras('2026-10-12'), '2026-10-12').otrasHoras).toEqual([
      { turnoId: 42, fecha: '2026-10-12', horaInicio: '10:00', horaFin: '11:00' },
    ])
  })

  it('otrasHoras: si esa hora tiene varios tramos, el del que tiene la primera ocurrencia', () => {
    // Se finaliza la hora de 10 desde el 26/10: la de 9 sigue recién en su segundo tramo (02/11).
    const s = serieDeDosHoras('2026-10-26', { turno: horaDe10 })

    expect(previaDe(s, '2026-10-26').otrasHoras).toEqual([
      { turnoId: 58, fecha: '2026-11-02', horaInicio: '09:00', horaFin: '10:00' },
    ])
  })

  it('otrasHoras: una hora sin ocurrencias desde fechaDesde, o ya finalizada, no se avisa', () => {
    // La hora de 10 terminó el 19/10: desde el 02/11 no tiene nada.
    const corta = { ...horaDe10, fechaFin: '2026-10-19' }
    const sinOcurrencias = serieDeDosHoras('2026-11-02', { filas: [tramoA, tramoB, corta] })
    sinOcurrencias.ocurrencias = sinOcurrencias.ocurrencias.filter((o) => o.turnoId !== 42)
    expect(previaDe(sinOcurrencias, '2026-11-02').otrasHoras).toEqual([])

    // La hora de 10 ya se finalizó desde el 16/11: aunque le queden fechas antes, no se avisa.
    const finalizada = { ...horaDe10, finalizadaDesde: '2026-11-16' }
    const s = serieDeDosHoras('2026-10-12', { filas: [tramoA, tramoB, finalizada] })
    expect(previaDe(s, '2026-10-12').otrasHoras).toEqual([])
  })

  it('una pagada en un tramo posterior cuenta; la fecha mínima puede caer en el otro tramo', () => {
    const s = serieDeDosHoras('2026-10-12')
    s.ocurrencias = s.ocurrencias.map((o) =>
      o.turnoId === 58 && o.fecha === '2026-11-16' ? { ...o, ...pagada(8500) } : o,
    )

    expect(previaDe(s, '2026-10-12')).toMatchObject({
      pagadas: [{ fecha: '2026-11-16', horaInicio: '09:00', horaFin: '10:00', importe: 8500 }],
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
    })
  })

  it('una pagada de la otra hora no impide finalizar esta', () => {
    const s = serieDeDosHoras('2026-10-12')
    s.ocurrencias = s.ocurrencias.map((o) => (o.turnoId === 42 ? { ...o, ...pagada(8500) } : o))

    expect(previaDe(s, '2026-10-12').pagadas).toEqual([])
  })
})

describe('planificarFinalizacion', () => {
  it('sin pagadas: devuelve la previa y el turno que lleva la finalización', () => {
    const plan = planificarFinalizacion(snapshot(), '2026-10-19', HOY)

    expect(plan.previa).toMatchObject({ cantidad: 7, desde: '2026-10-19', hasta: '2026-11-30' })
    expect(plan.turnoIds).toEqual([41])
  })

  it.each([
    ['en el primer tramo: los dos tramos', '2026-10-12', [41, 58]],
    ['en el hueco: sólo el tramo posterior', '2026-10-26', [58]],
    ['en el último tramo: sólo ese', '2026-11-16', [58]],
  ])('fechaDesde %s llevan la finalización', (_, fechaDesde, turnoIds) => {
    const plan = planificarFinalizacion(serieDeDosHoras(fechaDesde), fechaDesde, HOY)

    expect(plan.turnoIds).toEqual(turnoIds)
  })

  it('con pagadas → 409 TURNOS_PAGADOS con la última fecha en el mensaje y en details', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), {
        '2026-10-26': pagada(8500),
        '2026-11-16': pagada(8500),
      }),
    )

    const error = errorDe(() => planificarFinalizacion(s, '2026-10-19', HOY))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_PAGADOS')
    expect(error.message).toBe(
      'Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (16/11)',
    )
    expect(error.details).toEqual({
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
      pagadas: [
        { fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
        { fecha: '2026-11-16', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
      ],
    })
  })

  it('pagadas hasta el final de la serie → 409 TURNOS_PAGADOS sin fecha para elegir', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), { '2026-11-30': pagada(8500) }),
    )

    const error = errorDe(() => planificarFinalizacion(s, '2026-10-19', HOY))

    expect(error.code).toBe('TURNOS_PAGADOS')
    expect(error.message).toBe(
      'Los turnos pagados llegan hasta el final de la serie (30/11): no se puede finalizar',
    )
    expect(error.details).toMatchObject({
      ultimaFechaPagada: '2026-11-30',
      fechaDesdeMinima: null,
    })
  })

  it('una pagada anterior a fechaDesde no impide finalizar', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), { '2026-10-12': pagada(8500) }),
    )

    expect(planificarFinalizacion(s, '2026-10-19', HOY).previa.pagadas).toEqual([])
  })

  it('la validación del pedido va antes que las pagadas', () => {
    const s = snapshot(
      fila(),
      con(semanales('2026-10-05', '2026-11-30'), { '2026-10-26': pagada(8500) }),
    )

    expect(errorDe(() => planificarFinalizacion(s, '2026-10-20', HOY))).toBeInstanceOf(
      ValidationError,
    )
  })
})
