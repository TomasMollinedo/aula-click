import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/server/errors'
import type { BloqueDePrueba } from '@/server/features/turnos/__tests__/turnos-en-memoria'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import { crearReprogramacionesService } from '../reprogramaciones.service'
import type { ReprogramarTurno } from '../reprogramaciones.validation'
import {
  crearReprogramacionesEnMemoria,
  type Catalogo,
  type TurnoEnMemoria,
} from './reprogramaciones-en-memoria'

// Service de reprogramaciones (T-49) contra el repository en memoria (`reprogramaciones-en-memoria.ts`),
// que arma el snapshot con el motor de ocurrencias real, ejecuta el `planificar` real y aplica el
// plan a las tablas. Reloj fijo: lunes 05/10/2026 al mediodía en Salta. Lunes: 05, 12, 19, 26/10 y
// 02/11; jueves: 08, 15 y 22/10. El profesor 3 es "Apellido3" y el 7, "Apellido7".

const reloj = () => new Date('2026-10-05T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const BLOQUES: BloqueDePrueba[] = [
  { id: 10, profesorId: 3, aulaId: 1, diaSemana: 1, horaInicio: 540 }, // lunes 9–10, prof 3
  { id: 20, profesorId: 7, aulaId: 2, diaSemana: 1, horaInicio: 540 }, // lunes 9–10, prof 7
  { id: 30, profesorId: 7, aulaId: 2, diaSemana: 4, horaInicio: 1020 }, // jueves 17–18, prof 7
  { id: 31, profesorId: 3, aulaId: 1, diaSemana: 4, horaInicio: 1020 }, // jueves 17–18, prof 3
  { id: 32, profesorId: 3, aulaId: 1, diaSemana: 4, horaInicio: 1080, estado: 'INACTIVO' },
]

let turnos: TurnoEnMemoria[]
let catalogo: Catalogo
let memoria: ReturnType<typeof crearReprogramacionesEnMemoria>
let service: ReturnType<typeof crearReprogramacionesService>

const enTabla = (id: number) => turnos.find((t) => t.id === id)

function armar() {
  memoria = crearReprogramacionesEnMemoria(BLOQUES, turnos, catalogo)
  const turnosRepository = {
    buscarDetalle: vi.fn<TurnosRepository['buscarDetalle']>(async (id) => {
      const turno = enTabla(id)
      return (turno && {
        id,
        alumno: { id: turno.alumnoId ?? 12 },
        bloqueId: turno.bloqueAgendaId,
      }) as Awaited<ReturnType<TurnosRepository['buscarDetalle']>>
    }),
  }
  const bloquesRepository = {
    buscarPorIds: vi.fn<BloquesRepository['buscarPorIds']>(
      async (ids) =>
        BLOQUES.filter((b) => ids.includes(b.id)) as unknown as Awaited<
          ReturnType<BloquesRepository['buscarPorIds']>
        >,
    ),
  }
  service = crearReprogramacionesService({
    repository: memoria.repository,
    turnosRepository,
    bloquesRepository,
    reloj,
  })
}

beforeEach(() => {
  turnos = [
    {
      id: 41, // sesión única del lunes 12/10 con Apellido3
      bloqueAgendaId: 10,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-12',
      fechaFin: '2026-10-12',
      temas: 'Derivadas',
    },
    {
      id: 50, // recurrente de los lunes, del 05/10 al 02/11
      bloqueAgendaId: 10,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-10-05',
      fechaFin: '2026-11-02',
      observaciones: 'Viene con tarea',
      temas: 'Integrales',
    },
  ]
  catalogo = {
    profesores: new Map([
      [3, { capacidad: 3, estado: 'ACTIVO' as const }],
      [7, { capacidad: 3, estado: 'ACTIVO' as const }],
    ]),
    materia: { estado: 'ACTIVO' },
    asignacion: { estado: 'ACTIVO' },
    aulaCapacidad: 10,
  }
  armar()
})

function pedido(parcial: Partial<ReprogramarTurno> = {}): ReprogramarTurno {
  return {
    turnoId: 41,
    fecha: '2026-10-12',
    bloqueAgendaDestinoId: 30,
    fechaDestino: '2026-10-15',
    ...parcial,
  }
}

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  try {
    await promesa
  } catch (error) {
    if (error instanceof AppError) return error
    throw error
  }
  throw new Error('Se esperaba un error')
}

/** Los turnos de la tabla con sus fechas, para comparar de un vistazo. */
function resumen() {
  return turnos.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    bloque: t.bloqueAgendaId,
    desde: t.fechaInicio,
    hasta: t.fechaFin,
  }))
}

describe('reprogramar: sesión única', () => {
  it('edita el mismo turno: cambia el bloque y las fechas, y devuelve el texto del cambio', async () => {
    const resultado = await service.reprogramar(pedido(), actor)

    expect(resultado).toEqual({
      turnoId: 41,
      cambio:
        'Del lunes 12/10 9:00–10:00 con Prof. Apellido3 al jueves 15/10 17:00–18:00 con Prof. Apellido7',
    })
    expect(turnos).toHaveLength(2)
    expect(enTabla(41)).toMatchObject({
      tipo: 'SESION_UNICA',
      bloqueAgendaId: 30,
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-15',
      temas: 'Derivadas',
    })
    // El modificador es quien reprograma; la fecha de origen queda libre.
    expect(memoria.auditoria.get(41)?.updatedById).toBe('usr_mesa')
  })

  it('conserva el pago: pasa a la fecha nueva del mismo turno', async () => {
    const original = enTabla(41)
    if (original) original.pagos = [{ fecha: '2026-10-12', pagoId: 9, importe: 8000 }]

    await service.reprogramar(pedido(), actor)

    expect(enTabla(41)?.pagos).toEqual([{ fecha: '2026-10-15', pagoId: 9, importe: 8000 }])
  })

  it('puede quedarse con el mismo profesor y cambiar sólo el día', async () => {
    const resultado = await service.reprogramar(pedido({ bloqueAgendaDestinoId: 31 }), actor)

    expect(resultado.cambio).toBe(
      'Del lunes 12/10 9:00–10:00 con Prof. Apellido3 al jueves 15/10 17:00–18:00 con Prof. Apellido3',
    )
  })
})

describe('reprogramar: recurrente', () => {
  const enElMedio = () => pedido({ turnoId: 50, fecha: '2026-10-19', fechaDestino: '2026-10-22' })

  it('en el medio de la serie: parte en tres turnos con las fechas correctas', async () => {
    const resultado = await service.reprogramar(enElMedio(), actor)

    expect(resultado.turnoId).toBe(101) // la sesión única nueva
    expect(resumen().slice(1)).toEqual([
      { id: 50, tipo: 'RECURRENTE', bloque: 10, desde: '2026-10-05', hasta: '2026-10-12' },
      { id: 100, tipo: 'RECURRENTE', bloque: 10, desde: '2026-10-26', hasta: '2026-11-02' },
      { id: 101, tipo: 'SESION_UNICA', bloque: 30, desde: '2026-10-22', hasta: '2026-10-22' },
    ])
    // El tramo nuevo y la sesión única copian alumno, materia, observaciones y temas.
    for (const id of [100, 101]) {
      expect(enTabla(id)).toMatchObject({
        alumnoId: 12,
        materiaId: 3,
        observaciones: 'Viene con tarea',
        temas: 'Integrales',
      })
    }
    // Los creados llevan a quien reprograma como creador; el original queda con su modificación.
    expect(memoria.auditoria.get(100)).toEqual({ createdById: 'usr_mesa', updatedById: 'usr_mesa' })
    expect(memoria.auditoria.get(101)).toEqual({ createdById: 'usr_mesa', updatedById: 'usr_mesa' })
    expect(memoria.auditoria.get(50)?.updatedById).toBe('usr_mesa')
  })

  it('el pago de la fecha movida pasa a la sesión única con la fecha nueva', async () => {
    const original = enTabla(50)
    if (original) original.pagos = [{ fecha: '2026-10-19', pagoId: 9, importe: 8000 }]

    const { turnoId } = await service.reprogramar(enElMedio(), actor)

    expect(enTabla(turnoId)?.pagos).toEqual([{ fecha: '2026-10-22', pagoId: 9, importe: 8000 }])
    expect(enTabla(50)?.pagos).toEqual([])
  })

  it('las cancelaciones y los pagos de las fechas posteriores pasan al tramo nuevo', async () => {
    const original = enTabla(50)
    if (original) {
      original.cancelaciones = [{ fecha: '2026-10-12' }, { fecha: '2026-10-26' }]
      original.pagos = [
        { fecha: '2026-10-05', pagoId: 8, importe: 8000 },
        { fecha: '2026-11-02', pagoId: 10, importe: 8000 },
      ]
    }

    await service.reprogramar(enElMedio(), actor)

    // Las anteriores se quedan con el original.
    expect(enTabla(50)?.cancelaciones).toEqual([{ fecha: '2026-10-12' }])
    expect(enTabla(50)?.pagos).toEqual([{ fecha: '2026-10-05', pagoId: 8, importe: 8000 }])
    // Las posteriores pasan al tramo nuevo.
    expect(enTabla(100)?.cancelaciones).toEqual([{ fecha: '2026-10-26' }])
    expect(enTabla(100)?.pagos).toEqual([{ fecha: '2026-11-02', pagoId: 10, importe: 8000 }])
  })

  it('la finalización pasa al tramo nuevo', async () => {
    const original = enTabla(50)
    if (original) {
      original.fechaFin = null
      original.finalizadaDesde = '2026-11-02'
    }

    await service.reprogramar(enElMedio(), actor)

    expect(enTabla(100)).toMatchObject({ fechaInicio: '2026-10-26', fechaFin: null })
    expect(enTabla(100)?.finalizadaDesde).toBe('2026-11-02')
    expect(enTabla(50)?.finalizadaDesde).toBeUndefined()
  })

  it('primera fecha de la serie: el original arranca en la siguiente y no hay tramo nuevo', async () => {
    const original = enTabla(50)
    if (original) {
      original.cancelaciones = [{ fecha: '2026-10-19' }]
      original.pagos = [{ fecha: '2026-10-26', pagoId: 9, importe: 8000 }]
    }

    const { turnoId } = await service.reprogramar(
      pedido({ turnoId: 50, fecha: '2026-10-05', fechaDestino: '2026-10-08' }),
      actor,
    )

    expect(resumen().slice(1)).toEqual([
      { id: 50, tipo: 'RECURRENTE', bloque: 10, desde: '2026-10-12', hasta: '2026-11-02' },
      { id: 100, tipo: 'SESION_UNICA', bloque: 30, desde: '2026-10-08', hasta: '2026-10-08' },
    ])
    expect(turnoId).toBe(100)
    // Sus cancelaciones y pagos no se mueven.
    expect(enTabla(50)?.cancelaciones).toEqual([{ fecha: '2026-10-19' }])
    expect(enTabla(50)?.pagos).toHaveLength(1)
  })

  it('última fecha de la serie: el original termina en la anterior y no hay tramo nuevo', async () => {
    await service.reprogramar(
      pedido({ turnoId: 50, fecha: '2026-11-02', fechaDestino: '2026-11-05' }),
      actor,
    )

    expect(resumen().slice(1)).toEqual([
      { id: 50, tipo: 'RECURRENTE', bloque: 10, desde: '2026-10-05', hasta: '2026-10-26' },
      { id: 100, tipo: 'SESION_UNICA', bloque: 30, desde: '2026-11-05', hasta: '2026-11-05' },
    ])
  })

  it('última antes del fin efectivo (por una finalización): sin tramo nuevo y la finalización queda', async () => {
    const original = enTabla(50)
    if (original) {
      original.fechaFin = null
      original.finalizadaDesde = '2026-10-26' // la última ocurrencia es la del 19/10
    }

    await service.reprogramar(enElMedio(), actor)

    expect(resumen().slice(1)).toEqual([
      { id: 50, tipo: 'RECURRENTE', bloque: 10, desde: '2026-10-05', hasta: '2026-10-12' },
      { id: 100, tipo: 'SESION_UNICA', bloque: 30, desde: '2026-10-22', hasta: '2026-10-22' },
    ])
    expect(enTabla(50)?.finalizadaDesde).toBe('2026-10-26')
  })

  it('su única fecha: el original se edita como una sesión única en el destino, sin turnos nuevos', async () => {
    turnos.push({
      id: 70,
      bloqueAgendaId: 10,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-10-12',
      fechaFin: '2026-10-12',
      pagos: [{ fecha: '2026-10-12', pagoId: 9, importe: 8000 }],
      finalizadaDesde: '2026-10-13',
    })
    armar()

    const { turnoId } = await service.reprogramar(pedido({ turnoId: 70 }), actor)

    expect(turnoId).toBe(70)
    expect(turnos).toHaveLength(3)
    expect(enTabla(70)).toMatchObject({
      tipo: 'SESION_UNICA',
      bloqueAgendaId: 30,
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-15',
      pagos: [{ fecha: '2026-10-15', pagoId: 9, importe: 8000 }],
    })
    // Una finalización no tiene sentido en una sesión única (y cortaría la fecha movida).
    expect(enTabla(70)?.finalizadaDesde).toBeUndefined()
  })

  it('a otro profesor: el texto del cambio nombra a los dos', async () => {
    const { cambio } = await service.reprogramar(
      pedido({
        turnoId: 50,
        fecha: '2026-10-19',
        bloqueAgendaDestinoId: 30,
        fechaDestino: '2026-10-22',
      }),
      actor,
    )

    expect(cambio).toBe(
      'Del lunes 19/10 9:00–10:00 con Prof. Apellido3 al jueves 22/10 17:00–18:00 con Prof. Apellido7',
    )
  })
})

describe('reprogramar: el destino', () => {
  it('hora llena en la fecha de destino → 409 BLOQUE_LLENO', async () => {
    catalogo.profesores.set(7, { capacidad: 1, estado: 'ACTIVO' })
    turnos.push({
      id: 60,
      bloqueAgendaId: 30,
      alumnoId: 99,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-15',
    })
    armar()

    const error = await errorDe(service.reprogramar(pedido(), actor))

    expect(error.statusCode).toBe(409)
    expect(error.code).toBe('BLOQUE_LLENO')
    expect(enTabla(41)?.bloqueAgendaId).toBe(10) // no se movió nada
  })

  it('una hora llena en otra fecha no molesta', async () => {
    catalogo.profesores.set(7, { capacidad: 1, estado: 'ACTIVO' })
    turnos.push({
      id: 60,
      bloqueAgendaId: 30,
      alumnoId: 99,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-22',
      fechaFin: '2026-10-22',
    })
    armar()

    await expect(service.reprogramar(pedido(), actor)).resolves.toMatchObject({ turnoId: 41 })
  })

  it('la superposición con la propia ocurrencia no cuenta', async () => {
    // Mismo lunes 19/10 a las 9:00, ahora con el profesor 7: la serie se pisa con su propia fecha.
    const resultado = await service.reprogramar(
      pedido({
        turnoId: 50,
        fecha: '2026-10-19',
        bloqueAgendaDestinoId: 20,
        fechaDestino: '2026-10-19',
      }),
      actor,
    )

    expect(resultado.cambio).toBe(
      'Del lunes 19/10 9:00–10:00 con Prof. Apellido3 al lunes 19/10 9:00–10:00 con Prof. Apellido7',
    )
  })

  it('otro turno del alumno en ese horario → 409 ALUMNO_SUPERPUESTO', async () => {
    turnos.push({
      id: 61,
      bloqueAgendaId: 31,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-15',
    })
    armar()

    const error = await errorDe(service.reprogramar(pedido(), actor))

    expect(error.code).toBe('ALUMNO_SUPERPUESTO')
    expect(error.details).toMatchObject([{ turnoId: 61, horaInicio: '17:00', horaFin: '18:00' }])
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO', async () => {
    catalogo.profesores.set(7, { capacidad: 3, estado: 'INACTIVO' })
    armar()

    expect((await errorDe(service.reprogramar(pedido(), actor))).code).toBe('PROFESOR_INACTIVO')
  })

  it('materia no asignada al profesor de destino → 409 MATERIA_NO_ASIGNADA', async () => {
    catalogo.asignacion = null
    armar()

    expect((await errorDe(service.reprogramar(pedido(), actor))).code).toBe('MATERIA_NO_ASIGNADA')
  })

  it('materia inactiva → 409 MATERIA_INACTIVA', async () => {
    catalogo.materia = { estado: 'INACTIVO' }
    armar()

    expect((await errorDe(service.reprogramar(pedido(), actor))).code).toBe('MATERIA_INACTIVA')
  })

  it('fecha de destino anterior a hoy → 400 en fechaDestino', async () => {
    const error = await errorDe(service.reprogramar(pedido({ fechaDestino: '2026-10-01' }), actor))

    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual([expect.objectContaining({ path: ['fechaDestino'] })])
  })

  it('fecha de destino que no cae en el día de la hora → 400 en fechaDestino', async () => {
    const error = await errorDe(service.reprogramar(pedido({ fechaDestino: '2026-10-16' }), actor))

    expect(error.statusCode).toBe(400)
    expect(error.message).toBe('La fecha debe caer en jueves')
  })

  it('el mismo lugar que el de origen → 400', async () => {
    const error = await errorDe(
      service.reprogramar(pedido({ bloqueAgendaDestinoId: 10, fechaDestino: '2026-10-12' }), actor),
    )

    expect(error.statusCode).toBe(400)
  })

  it('hora de destino inexistente o dada de baja → 404', async () => {
    expect(
      (await errorDe(service.reprogramar(pedido({ bloqueAgendaDestinoId: 99 }), actor))).statusCode,
    ).toBe(404)
    expect(
      (await errorDe(service.reprogramar(pedido({ bloqueAgendaDestinoId: 32 }), actor))).statusCode,
    ).toBe(404)
  })
})

describe('reprogramar: la ocurrencia de origen', () => {
  it('ya pasada → 409, sin cambios', async () => {
    turnos.push({
      id: 62,
      bloqueAgendaId: 10,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-09-28',
      fechaFin: '2026-09-28',
    })
    armar()

    const error = await errorDe(
      service.reprogramar(pedido({ turnoId: 62, fecha: '2026-09-28' }), actor),
    )

    expect(error.statusCode).toBe(409)
    expect(enTabla(62)?.fechaInicio).toBe('2026-09-28')
  })

  it('la de hoy se puede reprogramar', async () => {
    turnos.push({
      id: 63,
      bloqueAgendaId: 10,
      tipo: 'SESION_UNICA',
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-05',
    })
    armar()

    await expect(
      service.reprogramar(
        pedido({ turnoId: 63, fecha: '2026-10-05', fechaDestino: '2026-10-08' }),
        actor,
      ),
    ).resolves.toMatchObject({ turnoId: 63 })
  })

  it('cancelada → 409', async () => {
    const original = enTabla(50)
    if (original) original.cancelaciones = [{ fecha: '2026-10-19' }]

    const error = await errorDe(
      service.reprogramar(
        pedido({ turnoId: 50, fecha: '2026-10-19', fechaDestino: '2026-10-22' }),
        actor,
      ),
    )

    expect(error.statusCode).toBe(409)
    expect(turnos).toHaveLength(2)
  })

  it('que el turno no genera en esa fecha → 404', async () => {
    // El turno 50 llega hasta el 02/11 y sólo tiene lunes.
    for (const fecha of ['2026-10-20', '2026-11-09']) {
      const error = await errorDe(
        service.reprogramar(pedido({ turnoId: 50, fecha, fechaDestino: '2026-11-12' }), actor),
      )
      expect(error.statusCode).toBe(404)
    }
  })

  it('turno inexistente → 404', async () => {
    expect((await errorDe(service.reprogramar(pedido({ turnoId: 999 }), actor))).statusCode).toBe(
      404,
    )
  })

  it('dos fechas de la misma serie, una tras otra: la segunda se lee sobre el tramo nuevo', async () => {
    // Después de mover el 19/10 quedan el 50 (hasta el 12/10) y el tramo 100 (desde el 26/10):
    // mover el 26/10 ahora es la primera fecha del tramo nuevo.
    await service.reprogramar(
      pedido({ turnoId: 50, fecha: '2026-10-19', fechaDestino: '2026-10-22' }),
      actor,
    )
    await service.reprogramar(
      pedido({ turnoId: 100, fecha: '2026-10-26', fechaDestino: '2026-10-29' }),
      actor,
    )

    expect(enTabla(100)).toMatchObject({ fechaInicio: '2026-11-02', fechaFin: '2026-11-02' })
  })
})
