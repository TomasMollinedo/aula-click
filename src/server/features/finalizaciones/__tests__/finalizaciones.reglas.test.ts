import { describe, expect, it } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  armarPrevia,
  planificarFinalizacion,
  validarFinalizacion,
  type OcurrenciaDeLaSerie,
  type SnapshotFinalizacion,
  type TurnoAFinalizar,
} from '../finalizaciones.reglas'
import { semanales } from './finalizaciones-en-memoria'

// Reglas puras de la finalización (T-47). Hoy es el lunes 05/10/2026; la serie es la de los lunes
// de 9 a 10, del 05/10 al 30/11 (9 fechas).

const HOY = '2026-10-05'

function turno(parcial: Partial<TurnoAFinalizar> = {}): TurnoAFinalizar {
  return {
    id: 41,
    alumnoId: 12,
    tipo: 'RECURRENTE',
    activo: true,
    fechaInicio: '2026-10-05',
    fechaFin: '2026-11-30',
    diaSemana: 1,
    tieneFinalizacion: false,
    ...parcial,
  }
}

function snapshot(parcial: Partial<SnapshotFinalizacion> = {}): SnapshotFinalizacion {
  return {
    turno: turno(),
    ocurrencias: semanales('2026-10-05', '2026-11-30'),
    otrosTramos: [],
    ...parcial,
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

describe('validarFinalizacion', () => {
  it('pedido válido: devuelve el turno', () => {
    expect(validarFinalizacion(snapshot(), '2026-10-19', HOY)).toEqual(turno())
  })

  it('turno inexistente → 404', () => {
    const error = errorDe(() => validarFinalizacion(snapshot({ turno: null }), '2026-10-19', HOY))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Turno no encontrado')
  })

  it.each([
    [
      'sesión única',
      turno({ tipo: 'SESION_UNICA', fechaFin: '2026-10-05' }),
      'Sólo se puede finalizar un turno recurrente',
    ],
    [
      'Turno.estado = CANCELADO',
      turno({ activo: false }),
      'El turno ya no está vigente: no se puede finalizar',
    ],
    [
      'fechaFin anterior a hoy',
      turno({ fechaInicio: '2026-09-07', fechaFin: '2026-09-28' }),
      'El turno ya no está vigente: no se puede finalizar',
    ],
    ['ya finalizado', turno({ tieneFinalizacion: true }), 'El turno ya fue finalizado'],
  ])('%s → 409 CONFLICTO', (_, t, mensaje) => {
    const error = errorDe(() => validarFinalizacion(snapshot({ turno: t }), '2026-10-19', HOY))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('CONFLICTO')
    expect(error.message).toBe(mensaje)
  })

  it('una serie que termina hoy sigue vigente (mismo criterio que el botón de T-43)', () => {
    const t = turno({ fechaInicio: '2026-09-28', fechaFin: HOY })

    expect(validarFinalizacion(snapshot({ turno: t }), HOY, HOY)).toEqual(t)
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
    const t = turno({ fechaInicio: fechaDesde < HOY ? '2026-09-21' : '2026-10-05' })
    const error = errorDe(() => validarFinalizacion(snapshot({ turno: t }), fechaDesde, HOY))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe(mensaje)
    expect(error.details).toEqual([{ path: ['fechaDesde'], message: mensaje }])
  })

  it('el 409 del turno gana sobre el 400 de la fecha', () => {
    const s = snapshot({ turno: turno({ tieneFinalizacion: true }) })

    expect(errorDe(() => validarFinalizacion(s, '2026-10-20', HOY))).toBeInstanceOf(ConflictError)
  })
})

describe('armarPrevia', () => {
  it('con fin: cantidad y rango hasta la última ocurrencia', () => {
    expect(armarPrevia(snapshot(), turno(), '2026-10-19')).toEqual({
      cantidad: 7,
      desde: '2026-10-19',
      hasta: '2026-11-30',
      pagadas: [],
      ultimaFechaPagada: null,
      fechaDesdeMinima: null,
      otrosTramos: [],
    })
  })

  it('hasta es la última ocurrencia, no la fechaFin cruda', () => {
    const t = turno({ fechaFin: '2026-12-03' })

    expect(armarPrevia(snapshot({ turno: t }), t, '2026-10-19')).toMatchObject({
      cantidad: 7,
      hasta: '2026-11-30',
    })
  })

  it('sin fin: cantidad y hasta en null', () => {
    const t = turno({ fechaFin: null })
    const s = snapshot({ turno: t, ocurrencias: semanales('2026-10-05', '2026-10-19') })

    expect(armarPrevia(s, t, '2026-10-19')).toMatchObject({
      cantidad: null,
      desde: '2026-10-19',
      hasta: null,
    })
  })

  it('una cancelada en el medio no cuenta', () => {
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), {
        '2026-11-02': { estado: 'CANCELADO' },
      }),
    })

    expect(armarPrevia(s, turno(), '2026-10-19')).toMatchObject({
      cantidad: 6,
      hasta: '2026-11-30',
    })
  })

  it('pagadas desde fechaDesde: lista, última fecha y fecha mínima (las anteriores no cuentan)', () => {
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), {
        '2026-10-12': pagada(8000),
        '2026-10-26': pagada(8500),
        '2026-11-16': pagada(9000.5),
      }),
    })

    expect(armarPrevia(s, turno(), '2026-10-19')).toMatchObject({
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
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), { '2026-11-30': pagada(8500) }),
    })

    expect(armarPrevia(s, turno(), '2026-10-19')).toMatchObject({
      ultimaFechaPagada: '2026-11-30',
      fechaDesdeMinima: null,
    })
  })

  it('sin fin, con pagadas: siempre hay fecha mínima', () => {
    const t = turno({ fechaFin: null })
    const s = snapshot({
      turno: t,
      ocurrencias: con(semanales('2026-10-05', '2026-11-09'), { '2026-11-09': pagada(8500) }),
    })

    expect(armarPrevia(s, t, '2026-10-19')).toMatchObject({
      cantidad: null,
      ultimaFechaPagada: '2026-11-09',
      fechaDesdeMinima: '2026-11-16',
    })
  })
})

describe('planificarFinalizacion', () => {
  it('sin pagadas: devuelve la previa', () => {
    expect(planificarFinalizacion(snapshot(), '2026-10-19', HOY)).toMatchObject({
      cantidad: 7,
      desde: '2026-10-19',
      hasta: '2026-11-30',
    })
  })

  it('con pagadas → 409 TURNOS_PAGADOS con la última fecha en el mensaje y en details', () => {
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), {
        '2026-10-26': pagada(8500),
        '2026-11-16': pagada(8500),
      }),
    })

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
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), { '2026-11-30': pagada(8500) }),
    })

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
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), { '2026-10-12': pagada(8500) }),
    })

    expect(planificarFinalizacion(s, '2026-10-19', HOY).pagadas).toEqual([])
  })

  it('la validación del pedido va antes que las pagadas', () => {
    const s = snapshot({
      ocurrencias: con(semanales('2026-10-05', '2026-11-30'), { '2026-10-26': pagada(8500) }),
    })

    expect(errorDe(() => planificarFinalizacion(s, '2026-10-20', HOY))).toBeInstanceOf(
      ValidationError,
    )
  })
})
