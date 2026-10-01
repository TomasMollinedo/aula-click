import { beforeEach, describe, expect, it } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { crearFinalizacionesService } from '../finalizaciones.service'
import { finalizarTurnoSchema, type FinalizarTurno } from '../finalizaciones.validation'
import {
  crearFinalizacionesEnMemoria,
  semanales,
  type TurnoEnBase,
} from './finalizaciones-en-memoria'

// Service de finalizaciones (T-47) contra el repository en memoria (`finalizaciones-en-memoria.ts`),
// que ejecuta el `verificar` real bajo una cola como el lock del alumno. Reloj fijo: lunes
// 05/10/2026 al mediodía en Salta. La serie 41 es la de los lunes de 9 a 10, del 05/10 al 30/11.

const reloj = () => new Date('2026-10-05T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

function turno(parcial: Partial<TurnoEnBase> = {}): TurnoEnBase {
  return {
    id: 41,
    alumnoId: 12,
    materiaId: 3,
    bloqueAgendaId: 7,
    tipo: 'RECURRENTE',
    activo: true,
    fechaInicio: '2026-10-05',
    fechaFin: '2026-11-30',
    diaSemana: 1,
    tieneFinalizacion: false,
    ocurrencias: semanales('2026-10-05', '2026-11-30'),
    ...parcial,
  }
}

/** Un tramo posterior de la serie 41: mismos alumno, materia y hora, desde el 14/12. */
function tramo(parcial: Partial<TurnoEnBase> = {}): TurnoEnBase {
  return turno({
    id: 58,
    fechaInicio: '2026-12-14',
    fechaFin: null,
    ocurrencias: [],
    ...parcial,
  })
}

let base: TurnoEnBase[]
let memoria: ReturnType<typeof crearFinalizacionesEnMemoria>
let service: ReturnType<typeof crearFinalizacionesService>

function armar(turnos: TurnoEnBase[]) {
  base = turnos
  memoria = crearFinalizacionesEnMemoria(base)
  service = crearFinalizacionesService({ repository: memoria.repository, reloj })
}

beforeEach(() => armar([turno()]))

function pedido(parcial: Partial<FinalizarTurno> = {}): FinalizarTurno {
  return { turnoId: 41, fechaDesde: '2026-10-19', motivo: 'CANCELACION_ALUMNO', ...parcial }
}

function pagar(fecha: string, importe = 8500) {
  const ocurrencia = base[0]?.ocurrencias.find((o) => o.fecha === fecha)
  if (ocurrencia) ocurrencia.pago = { estado: 'PAGADO', importeAplicado: importe }
}

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  try {
    await promesa
  } catch (error) {
    return error as AppError
  }
  throw new Error('Debía fallar')
}

describe('previa', () => {
  it('con fin: "Se liberan 7 turnos, del 19/10 al 30/11"', async () => {
    expect(await service.previa({ turnoId: 41, fechaDesde: '2026-10-19' })).toEqual({
      cantidad: 7,
      desde: '2026-10-19',
      hasta: '2026-11-30',
      pagadas: [],
      ultimaFechaPagada: null,
      fechaDesdeMinima: null,
      otrosTramos: [],
    })
  })

  it('sin fin: cantidad y hasta en null ("Se liberan todos los turnos desde el 19/10")', async () => {
    armar([turno({ fechaFin: null, ocurrencias: semanales('2026-10-05', '2026-10-19') })])

    expect(await service.previa({ turnoId: 41, fechaDesde: '2026-10-19' })).toMatchObject({
      cantidad: null,
      desde: '2026-10-19',
      hasta: null,
    })
  })

  it('con tramos posteriores del mismo alumno, materia y hora', async () => {
    armar([turno(), tramo(), tramo({ id: 59, fechaInicio: '2027-03-01', fechaFin: '2027-06-28' })])

    const previa = await service.previa({ turnoId: 41, fechaDesde: '2026-10-19' })

    expect(previa.otrosTramos).toEqual([
      { turnoId: 58, fechaInicio: '2026-12-14', fechaFin: null },
      { turnoId: 59, fechaInicio: '2027-03-01', fechaFin: '2027-06-28' },
    ])
  })

  it('un tramo de otra materia, de otro alumno, de otra hora, anterior o ya finalizado no aparece', async () => {
    armar([
      turno(),
      tramo({ id: 60, materiaId: 4 }),
      tramo({ id: 61, alumnoId: 13 }),
      tramo({ id: 62, bloqueAgendaId: 8 }),
      tramo({ id: 63, fechaInicio: '2026-09-07', fechaFin: '2026-09-28' }),
      tramo({ id: 64, tieneFinalizacion: true }),
      tramo({ id: 65, tipo: 'SESION_UNICA', fechaFin: '2026-12-14' }),
    ])

    const previa = await service.previa({ turnoId: 41, fechaDesde: '2026-10-19' })

    expect(previa.otrosTramos).toEqual([])
  })

  it('con pagadas: van en la lista, no es un error', async () => {
    pagar('2026-10-26')
    pagar('2026-11-16', 9000)

    expect(await service.previa({ turnoId: 41, fechaDesde: '2026-10-19' })).toMatchObject({
      cantidad: 7,
      pagadas: [
        { fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
        { fecha: '2026-11-16', horaInicio: '09:00', horaFin: '10:00', importe: 9000 },
      ],
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
    })
  })

  it('aplica las validaciones del POST: 404, 409 y 400', async () => {
    expect(await errorDe(service.previa({ turnoId: 99, fechaDesde: '2026-10-19' }))).toBeInstanceOf(
      NotFoundError,
    )
    expect(await errorDe(service.previa({ turnoId: 41, fechaDesde: '2026-10-20' }))).toBeInstanceOf(
      ValidationError,
    )
    armar([turno({ tieneFinalizacion: true })])
    expect(await errorDe(service.previa({ turnoId: 41, fechaDesde: '2026-10-19' }))).toBeInstanceOf(
      ConflictError,
    )
  })
})

describe('finalizar', () => {
  it('finaliza desde la fecha: devuelve lo liberado y registra motivo, detalle y creador', async () => {
    const res = await service.finalizar(pedido({ detalle: 'Deja de venir' }), actor)

    expect(res).toEqual({ turnoId: 41, cantidad: 7, desde: '2026-10-19', hasta: '2026-11-30' })
    expect(memoria.finalizaciones.get(41)).toEqual({
      fechaDesde: '2026-10-19',
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Deja de venir',
      createdById: 'usr_mesa',
    })
    expect(memoria.repository.finalizar.mock.calls[0]?.[0]).toEqual({
      turnoId: 41,
      alumnoId: 12,
      fechaDesde: '2026-10-19',
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Deja de venir',
    })
  })

  it('la fechaFin del turno no cambia después de finalizar', async () => {
    await service.finalizar(pedido(), actor)

    expect(base[0]?.fechaFin).toBe('2026-11-30')
    expect(base[0]?.fechaInicio).toBe('2026-10-05')
  })

  it('sin fin: cantidad y hasta en null', async () => {
    armar([turno({ fechaFin: null, ocurrencias: semanales('2026-10-05', '2026-10-19') })])

    expect(await service.finalizar(pedido(), actor)).toEqual({
      turnoId: 41,
      cantidad: null,
      desde: '2026-10-19',
      hasta: null,
    })
  })

  it('se finaliza sólo el tramo pedido: los posteriores quedan sin finalizar', async () => {
    armar([turno(), tramo()])

    await service.finalizar(pedido(), actor)

    expect([...memoria.finalizaciones.keys()]).toEqual([41])
  })

  it('turno inexistente → 404, sin llamar a finalizar', async () => {
    const error = await errorDe(service.finalizar(pedido({ turnoId: 99 }), actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Turno no encontrado')
    expect(memoria.repository.finalizar).not.toHaveBeenCalled()
  })

  it('sesión única → 409', async () => {
    armar([turno({ tipo: 'SESION_UNICA', fechaFin: '2026-10-05' })])

    const error = await errorDe(service.finalizar(pedido(), actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.message).toBe('Sólo se puede finalizar un turno recurrente')
    expect(memoria.repository.finalizar).not.toHaveBeenCalled()
  })

  it('no vigente (Turno.estado = CANCELADO o fechaFin pasada) → 409', async () => {
    armar([turno({ activo: false })])
    expect((await errorDe(service.finalizar(pedido(), actor))).message).toBe(
      'El turno ya no está vigente: no se puede finalizar',
    )

    armar([turno({ fechaInicio: '2026-09-07', fechaFin: '2026-09-28', ocurrencias: [] })])
    expect(await errorDe(service.finalizar(pedido(), actor))).toBeInstanceOf(ConflictError)
    expect(memoria.finalizaciones.size).toBe(0)
  })

  it('ya finalizada → 409', async () => {
    await service.finalizar(pedido(), actor)

    const error = await errorDe(service.finalizar(pedido({ fechaDesde: '2026-11-02' }), actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('CONFLICTO')
    expect(error.message).toBe('El turno ya fue finalizado')
    expect(memoria.finalizaciones.get(41)?.fechaDesde).toBe('2026-10-19')
  })

  it.each([
    ['en otro día de la semana', '2026-10-20', 'La fecha debe caer en lunes'],
    [
      'igual a fechaInicio',
      '2026-10-05',
      'Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno.',
    ],
    ['posterior al fin', '2026-12-07', 'La fecha es posterior al fin del turno (30/11)'],
  ])('fechaDesde %s → 400 en fechaDesde', async (_, fechaDesde, mensaje) => {
    const error = await errorDe(service.finalizar(pedido({ fechaDesde }), actor))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['fechaDesde'], message: mensaje }])
    expect(memoria.repository.finalizar).not.toHaveBeenCalled()
  })

  it('fechaDesde anterior a hoy → 400', async () => {
    armar([turno({ fechaInicio: '2026-09-21' })])

    const error = await errorDe(service.finalizar(pedido({ fechaDesde: '2026-09-28' }), actor))

    expect(error.details).toEqual([
      { path: ['fechaDesde'], message: 'La fecha no puede ser anterior a hoy' },
    ])
  })

  it('con pagadas → 409 TURNOS_PAGADOS con la lista y la última fecha, sin llamar a finalizar', async () => {
    pagar('2026-10-26')
    pagar('2026-11-16', 9000)

    const error = await errorDe(service.finalizar(pedido(), actor))

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
        { fecha: '2026-11-16', horaInicio: '09:00', horaFin: '10:00', importe: 9000 },
      ],
    })
    expect(memoria.repository.finalizar).not.toHaveBeenCalled()
    expect(memoria.finalizaciones.size).toBe(0)
  })

  it('pagadas hasta el final de la serie → 409 TURNOS_PAGADOS con fechaDesdeMinima null', async () => {
    pagar('2026-11-30')

    const error = await errorDe(service.finalizar(pedido(), actor))

    expect(error.code).toBe('TURNOS_PAGADOS')
    expect(error.message).toBe(
      'Los turnos pagados llegan hasta el final de la serie (30/11): no se puede finalizar',
    )
    expect(error.details).toMatchObject({ ultimaFechaPagada: '2026-11-30', fechaDesdeMinima: null })
  })

  it('eligiendo la fecha mínima que informa el 409, se finaliza', async () => {
    pagar('2026-10-26')

    const res = await service.finalizar(pedido({ fechaDesde: '2026-11-02' }), actor)

    expect(res).toEqual({ turnoId: 41, cantidad: 5, desde: '2026-11-02', hasta: '2026-11-30' })
  })

  it('carrera con un pago: aparece entre el chequeo previo y el lock → verificar lanza y no se inserta', async () => {
    const pago = memoria.pagar(41, '2026-10-26') // entra a la cola antes que la finalización
    const error = await errorDe(service.finalizar(pedido(), actor))
    await pago

    expect(memoria.repository.finalizar).toHaveBeenCalledTimes(1) // el chequeo previo pasó
    expect(error.code).toBe('TURNOS_PAGADOS')
    expect(error.details).toMatchObject({ ultimaFechaPagada: '2026-10-26' })
    expect(memoria.finalizaciones.size).toBe(0)
  })

  it('carrera con una reprogramación (T-49): el turno pasó a sesión única antes del lock → 409', async () => {
    const reprogramacion = memoria.pasarASesionUnica(41)
    const error = await errorDe(service.finalizar(pedido(), actor))
    await reprogramacion

    expect(memoria.repository.finalizar).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ConflictError)
    expect(error.message).toBe('Sólo se puede finalizar un turno recurrente')
    expect(memoria.finalizaciones.size).toBe(0)
  })

  it('dos finalizaciones simultáneas: gana una y la otra → 409 ya finalizado', async () => {
    const resultados = await Promise.allSettled([
      service.finalizar(pedido(), actor),
      service.finalizar(pedido({ fechaDesde: '2026-11-02' }), actor),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazo = resultados.find((r) => r.status === 'rejected')
    expect(((rechazo as PromiseRejectedResult).reason as AppError).message).toBe(
      'El turno ya fue finalizado',
    )
    expect(memoria.finalizaciones.size).toBe(1)
  })
})

describe('validación del body (Zod)', () => {
  const valido = {
    turnoId: 41,
    fechaDesde: '2026-10-19',
    motivo: 'OTRO',
    detalle: 'Se muda de ciudad',
  }

  it('OTRO con detalle es válido', () => {
    expect(finalizarTurnoSchema.safeParse(valido).success).toBe(true)
  })

  it.each([
    ['sin detalle', undefined],
    ['con detalle vacío', ''],
    ['con detalle de espacios', '   '],
    ['con detalle null', null],
  ])('OTRO %s → 400 en detalle', (_, detalle) => {
    const res = finalizarTurnoSchema.safeParse({ ...valido, detalle })

    expect(res.success).toBe(false)
    expect(res.error?.issues).toEqual([
      expect.objectContaining({
        path: ['detalle'],
        message: 'El detalle es obligatorio cuando el motivo es "Otro"',
      }),
    ])
  })

  it('otro motivo sin detalle es válido; un detalle vacío queda en null', () => {
    const res = finalizarTurnoSchema.safeParse({
      ...valido,
      motivo: 'CANCELACION_PROFESOR',
      detalle: ' ',
    })

    expect(res.success).toBe(true)
    expect(res.data?.detalle).toBeNull()
  })

  it('detalle de más de 500, motivo fuera del enum o fecha inexistente → 400', () => {
    expect(finalizarTurnoSchema.safeParse({ ...valido, detalle: 'x'.repeat(501) }).success).toBe(
      false,
    )
    expect(finalizarTurnoSchema.safeParse({ ...valido, motivo: 'PORQUE_SI' }).success).toBe(false)
    expect(finalizarTurnoSchema.safeParse({ ...valido, fechaDesde: '2026-02-30' }).success).toBe(
      false,
    )
  })
})
