import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { AlumnoGuardado } from '@/server/features/alumnos/alumnos.validation'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { BloqueDeProfesor } from '@/server/features/bloques/bloques.validation'
import {
  deudaVencida,
  type ClienteOcurrencias,
} from '@/server/features/cuentas/cuentas.condiciones'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { Estado } from '@/server/shared/estado'
import { minutosAHora } from '@/server/shared/zod'
import type { TurnosRepository } from '../turnos.repository'
import { finEfectivo, primeraFechaLibre, seCruzaCon } from '../turnos.reglas'
import { crearTurnosService } from '../turnos.service'
import type {
  CrearMiTurno,
  CrearTurno,
  FilaBloqueado,
  SerieFechas,
  SnapshotAlta,
  TipoTurno,
  TurnoDetalle,
} from '../turnos.validation'
import {
  crearTurnosEnMemoria,
  d,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from './turnos-en-memoria'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El de turnos es un fake en
// memoria que arma el snapshot como el real y ejecuta el `planificar` verdadero (el de
// `turnos.reglas.ts`), así las reglas del alta se prueban de punta a punta. El service los importa
// solo como tipo.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
/** El alumno 12 en el portal (HU-29): su usuario y su alumno vinculado salen de la sesión. */
const actorAlumno: Actor = { userId: 'usr_alumno_12', role: 'ALUMNO', alumnoId: 12 }

// Mediodía del martes 22/09/2026 en Salta (UTC-3). Los lunes siguientes: 28/09, 05/10, 12/10…
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

// ---------------------------------------------------------------------------------------------
// Base en memoria
// ---------------------------------------------------------------------------------------------

// Deuda (HU-29): los turnos ya dados del alumno, en la tabla en memoria del motor
// (`turnos-en-memoria.ts`). El `reservar` falso lee la deuda vencida con el `deudaVencida` real de
// `cuentas.condiciones` (T-76), como el repository dentro de su transacción: el tope de deuda se
// prueba de punta a punta. Hoy - 30 = domingo 23/08 (vencida); hoy - 29 = lunes 24/08.
const HOY_MENOS_30 = '2026-08-23'
const HOY_MENOS_29 = '2026-08-24'
const PRECIO_HORA = 8000
const BLOQUES_DEUDA: BloqueDePrueba[] = [
  { id: 90, profesorId: 4, aulaId: 3, diaSemana: 7, horaInicio: 540 }, // domingo 9–10
  { id: 91, profesorId: 4, aulaId: 3, diaSemana: 1, horaInicio: 600 }, // lunes 10–11
]
let turnosDados: TurnoDePrueba[]

/**
 * Un turno ya dado e impago del alumno 12 (Matemática, $ 8.000), en una fecha pasada: un domingo
 * (bloque 90) o un lunes (bloque 91).
 */
function adeudar(fecha: string, bloqueAgendaId = 90) {
  turnosDados.push({
    id: 500 + turnosDados.length,
    bloqueAgendaId,
    alumnoId: 12,
    materiaId: 3,
    fechaInicio: fecha,
    fechaFin: fecha,
  })
}

/** Cliente de Prisma falso para `deudaVencida`: turnos (motor), `aggregate` y precios. */
function clienteDeuda(): ClienteOcurrencias {
  const base = crearTurnosEnMemoria(BLOQUES_DEUDA, turnosDados)
  return {
    turno: {
      findMany: base.findMany,
      aggregate: async ({
        where,
      }: {
        where: { alumnoId?: number; fechaInicio: { lte: Date } }
      }) => {
        const inicios = turnosDados
          .filter(
            (t) =>
              (where.alumnoId === undefined || t.alumnoId === where.alumnoId) &&
              d(t.fechaInicio) <= where.fechaInicio.lte,
          )
          .map((t) => d(t.fechaInicio).getTime())
        return {
          _min: { fechaInicio: inicios.length === 0 ? null : new Date(Math.min(...inicios)) },
        }
      },
    },
    materia: {
      findMany: async ({ where }: { where: { id: { in: number[] } } }) =>
        where.id.in.map((id) => ({ id, precioHora: { toNumber: () => PRECIO_HORA } })),
    },
  } as unknown as ClienteOcurrencias
}

type ProfesorEnBase = {
  id: number
  nombre: string
  apellido: string
  capacidad: number
  estado: Estado
}
type TurnoEnBase = {
  id: number
  bloqueAgendaId: number
  alumnoId: number
  materiaId: number
  tipo: TipoTurno
  estado: 'ACTIVO' | 'CANCELADO'
  fechaInicio: string
  fechaFin: string | null
  /** La serie del alta (decisión T-103); los turnos sembrados a mano no la llevan. */
  serieId?: string | null
  /** Fechas canceladas (`CancelacionTurno`, T-30). */
  canceladas?: string[]
  /** `FinalizacionRecurrencia.fechaDesde`, si la serie se finalizó (T-30). */
  finalizadaDesde?: string
}

/** La serie como la lee el motor: fin efectivo y fechas canceladas. */
function serieDe(t: TurnoEnBase): SerieFechas {
  return {
    estado: t.estado,
    fechaInicio: t.fechaInicio,
    finEfectivo: finEfectivo(t, t.finalizadaDesde ? { fechaDesde: t.finalizadaDesde } : null),
    canceladas: t.canceladas ?? [],
  }
}

const fila = (
  id: number,
  horaInicio: number,
  extra: Partial<FilaBloqueado> = {},
): FilaBloqueado => ({
  id,
  estado: 'ACTIVO',
  profesorId: 4,
  diaSemana: 1,
  horaInicio,
  horaFin: horaInicio + 60,
  aulaCapacidad: 6,
  ...extra,
})

let filas: FilaBloqueado[]
let profesores: Map<number, ProfesorEnBase>
let materia: { id: number; nombre: string; estado: Estado } | null
let asignacion: { estado: Estado } | null
let turnos: TurnoEnBase[]

function sembrar() {
  filas = [
    fila(10, 480), // lunes 8–9, Ana
    fila(11, 540), // lunes 9–10, Ana
    fila(12, 600), // lunes 10–11, Ana
    fila(13, 540, { diaSemana: 2 }), // martes 9–10, Ana
    fila(20, 540, { profesorId: 7 }), // lunes 9–10, Juan
  ]
  profesores = new Map([
    [4, { id: 4, nombre: 'Ana', apellido: 'Pérez', capacidad: 6, estado: 'ACTIVO' }],
    [7, { id: 7, nombre: 'Juan', apellido: 'Ruiz', capacidad: 6, estado: 'ACTIVO' }],
  ])
  materia = { id: 3, nombre: 'Matemática', estado: 'ACTIVO' }
  asignacion = { estado: 'ACTIVO' }
  turnos = []
  turnosDados = []
}

/** Un turno ya guardado de otro alumno (por defecto) o del que se pide. */
function guardarTurno(datos: Partial<TurnoEnBase> & Pick<TurnoEnBase, 'bloqueAgendaId'>) {
  turnos.push({
    id: 100 + turnos.length,
    alumnoId: 99,
    materiaId: 3,
    tipo: 'SESION_UNICA',
    estado: 'ACTIVO',
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-05',
    ...datos,
  })
}

/** Llena una hora en una fecha (capacidad 6 de Ana). */
function llenar(
  bloqueAgendaId: number,
  fechaInicio: string,
  fechaFin: string | null = fechaInicio,
) {
  const tipo = fechaFin === fechaInicio ? 'SESION_UNICA' : 'RECURRENTE'
  for (let i = 0; i < 6; i += 1) guardarTurno({ bloqueAgendaId, fechaInicio, fechaFin, tipo })
}

function detalle(turno: TurnoEnBase): TurnoDetalle {
  const f = filas.find((x) => x.id === turno.bloqueAgendaId) ?? fila(0, 0)
  const profesor = profesores.get(f.profesorId)
  return {
    id: turno.id,
    tipo: turno.tipo,
    estado: turno.estado,
    fechaInicio: turno.fechaInicio,
    fechaFin: turno.fechaFin,
    diaSemana: f.diaSemana,
    horaInicio: minutosAHora(f.horaInicio),
    horaFin: minutosAHora(f.horaFin),
    bloqueId: f.id,
    alumno: { id: turno.alumnoId, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
    profesor: {
      id: f.profesorId,
      nombre: profesor?.nombre ?? '',
      apellido: profesor?.apellido ?? '',
    },
    materia: { id: turno.materiaId, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    observaciones: null,
    temas: null,
    createdAt: '2026-09-22T15:00:00.000Z',
    updatedAt: '2026-09-22T15:00:00.000Z',
    createdBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
    updatedBy: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  }
}

/**
 * `reservar` en memoria: una cola que ejecuta las reservas de a una (como el `FOR UPDATE` de las
 * filas de `bloque_agenda` en Postgres, que es la garantía real), arma el snapshot con los datos
 * de ese momento y ejecuta el `planificar` que le pasa el service. Si `planificar` lanza, no se
 * inserta nada.
 */
function crearReservarEnMemoria() {
  let cola: Promise<unknown> = Promise.resolve()
  const reservar: TurnosRepository['reservar'] = (entrada, planificar) => {
    const ejecucion = cola.then(async () => {
      const elegidas = filas.filter((f) => entrada.bloqueIds.includes(f.id))
      const profesor = profesores.get(entrada.profesorId)
      const snapshot: SnapshotAlta = {
        filas: elegidas.map((f) => ({ ...f })),
        profesor: profesor
          ? { id: profesor.id, capacidad: profesor.capacidad, estado: profesor.estado }
          : null,
        materia: materia && { id: materia.id, estado: materia.estado },
        asignacion,
        // Como `leerSeries`: las series de las filas pedidas que se cruzan con el pedido.
        ocupantes: turnos
          .filter(
            (t) =>
              entrada.bloqueIds.includes(t.bloqueAgendaId) &&
              seCruzaCon(t, entrada.fechaInicio, entrada.fechaFin),
          )
          .map((t) => ({ bloqueAgendaId: t.bloqueAgendaId, ...serieDe(t) })),
        // Como `superposicionesDelAlumno`: mismo día, en el rango de horas pedido, y con alguna
        // fecha que ocupa lugar dentro del pedido.
        turnosAlumno: turnos
          .filter((t) => t.alumnoId === entrada.alumnoId)
          .flatMap((t) => {
            const f = filas.find((x) => x.id === t.bloqueAgendaId)
            const desde = Math.min(...elegidas.map((e) => e.horaInicio))
            const hasta = Math.max(...elegidas.map((e) => e.horaFin))
            const enHorario =
              f &&
              elegidas.some((e) => e.diaSemana === f.diaSemana) &&
              f.horaInicio < hasta &&
              f.horaFin > desde
            if (
              !f ||
              !enHorario ||
              primeraFechaLibre(serieDe(t), entrada.fechaInicio, entrada.fechaFin) === null
            )
              return []
            const p = profesores.get(f.profesorId)
            return [
              {
                id: t.id,
                tipo: t.tipo,
                estado: t.estado,
                fechaInicio: t.fechaInicio,
                fechaFin: t.fechaFin,
                diaSemana: f.diaSemana,
                horaInicio: f.horaInicio,
                horaFin: f.horaFin,
                profesor: {
                  id: f.profesorId,
                  nombre: p?.nombre ?? '',
                  apellido: p?.apellido ?? '',
                },
                materia: { id: t.materiaId, nombre: 'Matemática' },
              },
            ]
          }),
        // Como el repository: la deuda vencida del alumno, leída con su lock tomado.
        deudaVencida: await deudaVencida(clienteDeuda(), {
          alumnoId: entrada.alumnoId,
          hoy: entrada.hoy,
        }),
      }
      // Cede el turno entre la lectura y la escritura: sin la cola, otra reserva se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = planificar(snapshot)
      const creados = plan.turnos.map((t) => {
        const guardado: TurnoEnBase = { id: 200 + turnos.length, ...t }
        turnos.push(guardado)
        return guardado
      })
      const orden = (t: TurnoEnBase) =>
        (filas.find((f) => f.id === t.bloqueAgendaId)?.horaInicio ?? 0) * 1e8 +
        Number(t.fechaInicio.replaceAll('-', ''))
      return {
        turnos: [...creados].sort((a, b) => orden(a) - orden(b)).map(detalle),
        fechasSinTurno: plan.fechasSinTurno,
      }
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  }
  return reservar
}

// ---------------------------------------------------------------------------------------------
// Service con sus falsos
// ---------------------------------------------------------------------------------------------

function crearRepositories() {
  return {
    repository: {
      contarOcupacionPorBloque: vi.fn<TurnosRepository['contarOcupacionPorBloque']>(),
      reservar: vi.fn<TurnosRepository['reservar']>(),
      buscarDetalle: vi.fn<TurnosRepository['buscarDetalle']>(),
      deudaVencidaDe: vi.fn<TurnosRepository['deudaVencidaDe']>(),
      listarMateriasOfertadas: vi.fn<TurnosRepository['listarMateriasOfertadas']>(),
    },
    alumnosRepository: { buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>() },
    bloquesRepository: {
      buscarPorIds: vi.fn<BloquesRepository['buscarPorIds']>(),
      listarActivasDeProfesores: vi.fn<BloquesRepository['listarActivasDeProfesores']>(),
    },
    profesoresRepository: {
      listarProfesoresActivosDeMateria:
        vi.fn<ProfesoresRepository['listarProfesoresActivosDeMateria']>(),
      buscarConAsignaciones: vi.fn<ProfesoresRepository['buscarConAsignaciones']>(),
    },
    materiasRepository: {
      buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>(),
      buscarPorId: vi.fn<MateriasRepository['buscarPorId']>(),
    },
  }
}

let repos: ReturnType<typeof crearRepositories>
let service: ReturnType<typeof crearTurnosService>

beforeEach(() => {
  sembrar()
  repos = crearRepositories()
  let altas = 0
  // Un id de serie distinto por alta ("serie-1", "serie-2", …), en lugar del `randomUUID` real.
  service = crearTurnosService({
    ...repos,
    reloj: relojFijo,
    generarSerieId: () => `serie-${(altas += 1)}`,
  })

  repos.repository.reservar.mockImplementation(crearReservarEnMemoria())
  repos.repository.contarOcupacionPorBloque.mockResolvedValue([])
  repos.alumnosRepository.buscarPorId.mockImplementation(async (id) =>
    id === 12 || id === 13 ? ({ id } as AlumnoGuardado) : null,
  )
  repos.bloquesRepository.buscarPorIds.mockImplementation(async (ids) =>
    filas
      .filter((f) => ids.includes(f.id))
      .map((f) => ({
        id: f.id,
        profesorId: f.profesorId,
        aulaId: 3,
        diaSemana: f.diaSemana,
        horaInicio: f.horaInicio,
        horaFin: f.horaFin,
        estado: f.estado,
      })),
  )
  repos.profesoresRepository.buscarConAsignaciones.mockImplementation(async (id) => {
    const profesor = profesores.get(id)
    return (
      (profesor && {
        estado: profesor.estado,
        asignaciones: asignacion ? [{ materiaId: 3, nombre: 'Matemática', ...asignacion }] : [],
      }) ??
      null
    )
  })
  repos.materiasRepository.buscarPorIds.mockImplementation(async () => (materia ? [materia] : []))
  repos.profesoresRepository.listarProfesoresActivosDeMateria.mockResolvedValue([
    { id: 7, apellido: 'Ruiz', nombre: 'Juan', estado: 'ACTIVO' },
    { id: 4, apellido: 'Pérez', nombre: 'Ana', estado: 'ACTIVO' },
  ])
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>): Promise<AppError> {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => {
      expect(error).toBeInstanceOf(AppError)
      return error as AppError
    },
  )
}

// ---------------------------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------------------------

describe('disponibilidad', () => {
  const bloque = (
    id: number,
    profesorId: number,
    diaSemana: number,
    horaInicio: number,
    aula = { id: 3, nombre: 'Aula 3', capacidad: 8 },
  ): BloqueDeProfesor => ({
    id,
    profesorId,
    profesorCapacidad: 6,
    diaSemana,
    horaInicio,
    horaFin: horaInicio + 60,
    aula,
  })

  beforeEach(() => {
    // Ordenadas por profesorId (como el repository): Ana (4) antes que Juan (7).
    repos.bloquesRepository.listarActivasDeProfesores.mockResolvedValue([
      bloque(10, 4, 1, 480),
      bloque(11, 4, 1, 540),
      bloque(12, 4, 1, 660), // no contigua: otro resultado
      bloque(14, 4, 1, 720, { id: 5, nombre: 'Aula 5', capacidad: 2 }), // contigua, otra aula
      bloque(13, 4, 2, 540),
      bloque(20, 7, 1, 540),
    ])
  })

  it('materia sola: todos los profesores que la dictan, agrupados, en el orden de los profesores, con ocupación y lleno', async () => {
    repos.repository.contarOcupacionPorBloque.mockResolvedValue([
      { bloqueAgendaId: 10, fecha: '2026-09-28', cantidad: 6 },
      { bloqueAgendaId: 11, fecha: '2026-09-28', cantidad: 2 },
    ])

    const resultado = await service.disponibilidad({ materiaId: 3 })

    expect(repos.bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [7, 4],
      diaSemana: undefined,
    })
    const hora = (
      bloqueId: number,
      horaInicio: string,
      horaFin: string,
      ocupacion = 0,
      capacidad = 6,
    ) => ({
      bloqueId,
      horaInicio,
      horaFin,
      capacidadEfectiva: capacidad,
      ocupacion,
      lleno: ocupacion >= capacidad,
    })
    const juan = { id: 7, nombre: 'Juan', apellido: 'Ruiz' }
    const ana = { id: 4, nombre: 'Ana', apellido: 'Pérez' }
    const aula3 = { id: 3, nombre: 'Aula 3' }
    expect(resultado).toEqual([
      {
        profesor: juan,
        diaSemana: 1,
        fecha: '2026-09-28',
        aula: aula3,
        horaInicio: '09:00',
        horaFin: '10:00',
        horas: [hora(20, '09:00', '10:00')],
      },
      {
        profesor: ana,
        diaSemana: 1,
        fecha: '2026-09-28',
        aula: aula3,
        horaInicio: '08:00',
        horaFin: '10:00',
        horas: [hora(10, '08:00', '09:00', 6), hora(11, '09:00', '10:00', 2)],
      },
      {
        profesor: ana,
        diaSemana: 1,
        fecha: '2026-09-28',
        aula: aula3,
        horaInicio: '11:00',
        horaFin: '12:00',
        horas: [hora(12, '11:00', '12:00')],
      },
      {
        profesor: ana,
        diaSemana: 1,
        fecha: '2026-09-28',
        aula: { id: 5, nombre: 'Aula 5' },
        horaInicio: '12:00',
        horaFin: '13:00',
        horas: [hora(14, '12:00', '13:00', 0, 2)],
      },
      {
        profesor: ana,
        diaSemana: 2,
        fecha: '2026-09-22', // hoy es martes: hoy incluido
        aula: aula3,
        horaInicio: '09:00',
        horaFin: '10:00',
        horas: [hora(13, '09:00', '10:00')],
      },
    ])
  })

  it('una sola consulta de ocupación, con cada fila y la próxima fecha de su día', async () => {
    await service.disponibilidad({ materiaId: 3 })

    expect(repos.repository.contarOcupacionPorBloque).toHaveBeenCalledTimes(1)
    expect(repos.repository.contarOcupacionPorBloque).toHaveBeenCalledWith([
      { bloqueAgendaId: 10, fecha: '2026-09-28' },
      { bloqueAgendaId: 11, fecha: '2026-09-28' },
      { bloqueAgendaId: 12, fecha: '2026-09-28' },
      { bloqueAgendaId: 14, fecha: '2026-09-28' },
      { bloqueAgendaId: 13, fecha: '2026-09-22' },
      { bloqueAgendaId: 20, fecha: '2026-09-28' },
    ])
  })

  it('materia y día: filtra las filas por ese día', async () => {
    await service.disponibilidad({ materiaId: 3, diaSemana: 2 })

    expect(repos.bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [7, 4],
      diaSemana: 2,
    })
  })

  it('materia y profesor: solo ese profesor', async () => {
    await service.disponibilidad({ materiaId: 3, profesorId: 4 })

    expect(repos.bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [4],
      diaSemana: undefined,
    })
  })

  it('materia, día y profesor combinados', async () => {
    await service.disponibilidad({ materiaId: 3, diaSemana: 1, profesorId: 7 })

    expect(repos.bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [7],
      diaSemana: 1,
    })
  })

  it('un profesor que no dicta la materia no es error: []', async () => {
    expect(await service.disponibilidad({ materiaId: 3, profesorId: 99 })).toEqual([])
    expect(repos.bloquesRepository.listarActivasDeProfesores).not.toHaveBeenCalled()
  })

  it('con fecha: el día sale de ella y la ocupación es la de esa fecha', async () => {
    repos.bloquesRepository.listarActivasDeProfesores.mockResolvedValue([bloque(10, 4, 1, 480)])

    const [resultado] = await service.disponibilidad({ materiaId: 3, fecha: '2026-10-12' })

    expect(repos.bloquesRepository.listarActivasDeProfesores).toHaveBeenCalledWith({
      profesorIds: [7, 4],
      diaSemana: 1,
    })
    expect(repos.repository.contarOcupacionPorBloque).toHaveBeenCalledWith([
      { bloqueAgendaId: 10, fecha: '2026-10-12' },
    ])
    expect(resultado?.fecha).toBe('2026-10-12')
  })

  it('fecha y diaSemana coherentes: se acepta; incoherentes: 400 en fecha', async () => {
    await expect(
      service.disponibilidad({ materiaId: 3, fecha: '2026-10-12', diaSemana: 1 }),
    ).resolves.toBeDefined()

    const error = await errorDe(
      service.disponibilidad({ materiaId: 3, fecha: '2026-10-12', diaSemana: 2 }),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['fecha'], message: 'La fecha debe caer en martes' }])
  })

  it('fecha anterior a hoy: 400 (hoy se acepta)', async () => {
    const error = await errorDe(service.disponibilidad({ materiaId: 3, fecha: '2026-09-21' }))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fecha'], message: 'La fecha no puede ser anterior a hoy' },
    ])
    await expect(
      service.disponibilidad({ materiaId: 3, fecha: '2026-09-22' }),
    ).resolves.toBeDefined()
  })

  it('materia inexistente: 404', async () => {
    materia = null
    expect(await errorDe(service.disponibilidad({ materiaId: 3 }))).toBeInstanceOf(NotFoundError)
  })

  it('materia inactiva: 409 MATERIA_INACTIVA sin details', async () => {
    materia = { id: 3, nombre: 'Matemática', estado: 'INACTIVO' }
    const error = await errorDe(service.disponibilidad({ materiaId: 3 }))
    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('MATERIA_INACTIVA')
    expect(error.details).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------------------------

const SESION: CrearTurno = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'SESION_UNICA',
  fechaInicio: '2026-10-05',
  asignarDondeHayLugar: false,
}
const RECURRENTE: CrearTurno = {
  ...SESION,
  tipo: 'RECURRENTE',
  fechaInicio: '2026-10-05',
  fechaFin: '2026-11-30',
}

const resumen = (t: TurnoDetalle) => [t.bloqueId, t.tipo, t.fechaInicio, t.fechaFin]

describe('crear: caminos felices', () => {
  it('sesión única: un turno con fechaFin = fechaInicio, ACTIVO', async () => {
    const alta = await service.crear({ ...SESION, observaciones: 'Repaso' }, actor)

    expect(alta.cantidad).toBe(1)
    expect(alta.turnos.map(resumen)).toEqual([[11, 'SESION_UNICA', '2026-10-05', '2026-10-05']])
    expect(alta.fechasSinTurno).toEqual([])
    expect(turnos).toEqual([
      expect.objectContaining({
        estado: 'ACTIVO',
        alumnoId: 12,
        materiaId: 3,
        observaciones: 'Repaso',
      }),
    ])
  })

  it('dos horas no consecutivas (8–9 y 10–11): dos turnos con la misma materia, tipo y fechas', async () => {
    const alta = await service.crear({ ...SESION, bloqueIds: [12, 10] }, actor)

    expect(alta.cantidad).toBe(2)
    expect(alta.turnos.map(resumen)).toEqual([
      [10, 'SESION_UNICA', '2026-10-05', '2026-10-05'],
      [12, 'SESION_UNICA', '2026-10-05', '2026-10-05'],
    ])
    expect(new Set(alta.turnos.map((t) => t.materia.id))).toEqual(new Set([3]))
  })

  it('una sesión única (también de varias horas) no lleva serieId', async () => {
    await service.crear({ ...SESION, bloqueIds: [12, 10] }, actor)

    expect(turnos.map((t) => t.serieId)).toEqual([null, null])
  })

  it('recurrente de 2 horas con fechas llenas: todas las filas comparten un serieId', async () => {
    llenar(10, '2026-10-26') // la hora de 8 queda en dos tramos
    llenar(11, '2026-10-12') // y la de 9, en otros dos

    const alta = await service.crear(
      { ...RECURRENTE, bloqueIds: [10, 11], asignarDondeHayLugar: true },
      actor,
    )

    expect(alta.turnos.map(resumen)).toEqual([
      [10, 'RECURRENTE', '2026-10-05', '2026-10-19'],
      [10, 'RECURRENTE', '2026-11-02', '2026-11-30'],
      [11, 'RECURRENTE', '2026-10-05', '2026-10-05'],
      [11, 'RECURRENTE', '2026-10-19', '2026-11-30'],
    ])
    const creados = turnos.filter((t) => t.alumnoId === 12)
    expect(creados).toHaveLength(4)
    expect(new Set(creados.map((t) => t.serieId))).toEqual(new Set(['serie-1']))
  })

  it('dos altas recurrentes separadas son dos series distintas', async () => {
    await service.crear({ ...RECURRENTE, bloqueIds: [10] }, actor)
    await service.crear({ ...RECURRENTE, bloqueIds: [12] }, actor)

    expect(turnos.map((t) => t.serieId)).toEqual(['serie-1', 'serie-2'])
  })

  it('recurrente con fin', async () => {
    const alta = await service.crear(RECURRENTE, actor)
    expect(alta.turnos.map(resumen)).toEqual([[11, 'RECURRENTE', '2026-10-05', '2026-11-30']])
  })

  it('recurrente sin fin (fechaFin null u omitida)', async () => {
    const alta = await service.crear({ ...RECURRENTE, fechaFin: null }, actor)
    expect(alta.turnos.map(resumen)).toEqual([[11, 'RECURRENTE', '2026-10-05', null]])
  })

  it('hoy se permite como fecha de inicio', async () => {
    const alta = await service.crear(
      { ...SESION, bloqueIds: [13], fechaInicio: '2026-09-22' },
      actor,
    )
    expect(alta.cantidad).toBe(1)
  })
})

describe('crear: capacidad (BLOQUE_LLENO)', () => {
  it('sesión única en una hora llena: 409 sin lugar, aun con la bandera', async () => {
    llenar(11, '2026-10-05')

    const error = await errorDe(service.crear({ ...SESION, asignarDondeHayLugar: true }, actor))

    expect(error.code).toBe('BLOQUE_LLENO')
    expect(error.details).toEqual([
      {
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 05/10',
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        capacidadEfectiva: 6,
        fechas: ['2026-10-05'],
        completoDesde: null,
        sinLugar: true,
      },
    ])
  })

  it('recurrente con algunas fechas llenas: 409 con las fechas; con la bandera, se crea en tramos', async () => {
    llenar(11, '2026-10-26')

    const error = await errorDe(service.crear(RECURRENTE, actor))
    expect(error.code).toBe('BLOQUE_LLENO')
    expect(error.message).toMatch(/^Hay fechas sin lugar/)
    expect(error.details).toEqual([
      expect.objectContaining({
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
        fechas: ['2026-10-26'],
        completoDesde: null,
        sinLugar: false,
      }),
    ])
    expect(turnos).toHaveLength(6) // no se creó nada

    const alta = await service.crear({ ...RECURRENTE, asignarDondeHayLugar: true }, actor)
    expect(alta.cantidad).toBe(2)
    expect(alta.turnos.map(resumen)).toEqual([
      [11, 'RECURRENTE', '2026-10-05', '2026-10-19'],
      [11, 'RECURRENTE', '2026-11-02', '2026-11-30'],
    ])
    expect(alta.fechasSinTurno).toEqual([
      {
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        fechas: ['2026-10-26'],
        completoDesde: null,
      },
    ])
  })

  it('recurrente sin fin con la hora llena desde una fecha: completoDesde en el 409 y en el alta', async () => {
    llenar(11, '2026-11-02', null)

    const error = await errorDe(service.crear({ ...RECURRENTE, fechaFin: null }, actor))
    expect(error.details).toEqual([
      expect.objectContaining({
        message: 'La hora de 9:00 a 10:00 está completa desde el lunes 02/11',
        completoDesde: '2026-11-02',
      }),
    ])

    const alta = await service.crear(
      { ...RECURRENTE, fechaFin: null, asignarDondeHayLugar: true },
      actor,
    )
    expect(alta.turnos.map(resumen)).toEqual([[11, 'RECURRENTE', '2026-10-05', '2026-10-26']])
    expect(alta.fechasSinTurno[0]?.completoDesde).toBe('2026-11-02')
  })

  it('recurrente sin lugar en ninguna fecha: 409 aun con la bandera', async () => {
    llenar(11, '2026-09-28', null)

    const error = await errorDe(service.crear({ ...RECURRENTE, asignarDondeHayLugar: true }, actor))

    expect(error.code).toBe('BLOQUE_LLENO')
    expect(error.message).toMatch(/^No hay lugar/)
    expect(error.details).toEqual([
      expect.objectContaining({
        message: 'La hora de 9:00 a 10:00 no tiene lugar en ninguna de las fechas pedidas',
        sinLugar: true,
      }),
    ])
  })

  it('la capacidad es min(profesor, aula) por hora', async () => {
    filas = filas.map((f) => (f.id === 11 ? { ...f, aulaCapacidad: 1 } : f))
    guardarTurno({ bloqueAgendaId: 11 })

    expect((await errorDe(service.crear(SESION, actor))).code).toBe('BLOQUE_LLENO')
  })

  it('un turno cancelado no ocupa lugar', async () => {
    llenar(11, '2026-10-05')
    turnos = turnos.map((t) => ({ ...t, estado: 'CANCELADO' }))

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })
})

describe('crear: alumno superpuesto (ALUMNO_SUPERPUESTO)', () => {
  it('sesión única contra un recurrente suyo del lunes 9–10 (de otro profesor): 409 aun con la bandera', async () => {
    guardarTurno({
      bloqueAgendaId: 20,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-26',
    })

    const error = await errorDe(service.crear({ ...SESION, asignarDondeHayLugar: true }, actor))

    expect(error.code).toBe('ALUMNO_SUPERPUESTO')
    expect(error.message).toBe('El alumno ya tiene un turno en ese horario')
    expect(error.details).toEqual([
      {
        turnoId: 100,
        tipo: 'RECURRENTE',
        fechaInicio: '2026-09-28',
        fechaFin: '2026-10-26',
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        profesor: { id: 7, nombre: 'Juan', apellido: 'Ruiz' },
        materia: { id: 3, nombre: 'Matemática' },
      },
    ])
  })

  it('recurrente contra un recurrente sin fin suyo: 409 aun con la bandera', async () => {
    guardarTurno({
      bloqueAgendaId: 11,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      fechaInicio: '2027-01-04',
      fechaFin: null,
    })

    const error = await errorDe(
      service.crear({ ...RECURRENTE, fechaFin: null, asignarDondeHayLugar: true }, actor),
    )
    expect(error.code).toBe('ALUMNO_SUPERPUESTO')
  })

  it('otra hora del mismo día, u otro rango de fechas, no se superpone', async () => {
    guardarTurno({ bloqueAgendaId: 10, alumnoId: 12, fechaInicio: '2026-10-05' }) // 8–9
    guardarTurno({
      bloqueAgendaId: 11,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-12-07',
      fechaFin: null,
    }) // 9–10, desde diciembre

    expect((await service.crear(RECURRENTE, actor)).cantidad).toBe(1)
  })
})

describe('crear: validaciones del service', () => {
  it('fechaInicio anterior a hoy: 400 en fechaInicio', async () => {
    const error = await errorDe(service.crear({ ...SESION, fechaInicio: '2026-09-21' }, actor))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fechaInicio'], message: 'La fecha no puede ser anterior a hoy' },
    ])
  })

  it('alumno inexistente: 404', async () => {
    expect(await errorDe(service.crear({ ...SESION, alumnoId: 50 }, actor))).toBeInstanceOf(
      NotFoundError,
    )
  })

  it('hora inexistente o dada de baja: 404 con cada posición en details', async () => {
    filas = filas.map((f) => (f.id === 12 ? { ...f, estado: 'INACTIVO' } : f))

    const error = await errorDe(service.crear({ ...SESION, bloqueIds: [10, 12, 99] }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.details).toEqual([
      { path: ['bloqueIds', 1], message: 'El bloque 12 no existe o fue dado de baja' },
      { path: ['bloqueIds', 2], message: 'El bloque 99 no existe o fue dado de baja' },
    ])
  })

  it('horas de más de un profesor: 400 en bloqueIds', async () => {
    const error = await errorDe(service.crear({ ...SESION, bloqueIds: [10, 20] }, actor))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' },
    ])
  })

  it('horas de más de un día: 400 en bloqueIds', async () => {
    const error = await errorDe(service.crear({ ...SESION, bloqueIds: [10, 13] }, actor))
    expect(error.details).toEqual([
      { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo día' },
    ])
  })

  it('fechas que no caen en el día de las horas: 400 en cada campo', async () => {
    const error = await errorDe(
      service.crear({ ...RECURRENTE, fechaInicio: '2026-10-06', fechaFin: '2026-11-29' }, actor),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fechaInicio'], message: 'La fecha debe caer en lunes' },
      { path: ['fechaFin'], message: 'La fecha debe caer en lunes' },
    ])
  })

  it('profesor inexistente: 404', async () => {
    repos.profesoresRepository.buscarConAsignaciones.mockResolvedValue(null)
    const error = await errorDe(service.crear(SESION, actor))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Profesor no encontrado')
  })

  it('profesor inactivo: 409 PROFESOR_INACTIVO', async () => {
    profesores.set(4, { ...profesores.get(4)!, estado: 'INACTIVO' })
    const error = await errorDe(service.crear(SESION, actor))
    expect(error.code).toBe('PROFESOR_INACTIVO')
    expect(error.message).toBe('El profesor está inactivo: no se le pueden asignar turnos')
  })

  it('materia inexistente: 404', async () => {
    materia = null
    expect(await errorDe(service.crear(SESION, actor))).toBeInstanceOf(NotFoundError)
  })

  it('materia inactiva: 409 MATERIA_INACTIVA en materiaId', async () => {
    materia = { id: 3, nombre: 'Matemática', estado: 'INACTIVO' }
    const error = await errorDe(service.crear(SESION, actor))
    expect(error.code).toBe('MATERIA_INACTIVA')
    expect(error.details).toEqual([
      { path: ['materiaId'], message: 'La materia está inactiva: no se le pueden asignar turnos' },
    ])
  })

  it('materia no asignada al profesor (o asignación inactiva): 409 MATERIA_NO_ASIGNADA', async () => {
    asignacion = null
    expect((await errorDe(service.crear(SESION, actor))).code).toBe('MATERIA_NO_ASIGNADA')
    asignacion = { estado: 'INACTIVO' }
    expect((await errorDe(service.crear(SESION, actor))).code).toBe('MATERIA_NO_ASIGNADA')
  })

  it('ningún error del service llega a reservar', async () => {
    materia = null
    await errorDe(service.crear(SESION, actor))
    expect(repos.repository.reservar).not.toHaveBeenCalled()
  })

  it('pasa al repository el rango pedido y, en una sesión única, fechaFin = fechaInicio', async () => {
    await service.crear({ ...SESION, fechaFin: '2026-10-05' }, actor)
    expect(repos.repository.reservar).toHaveBeenCalledWith(
      {
        hoy: '2026-09-22',
        alumnoId: 12,
        profesorId: 4,
        materiaId: 3,
        bloqueIds: [11],
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-05',
      },
      expect.any(Function),
      actor,
    )
  })
})

describe('crear: concurrencia', () => {
  // La garantía real es el `FOR UPDATE` de las filas de `bloque_agenda` en Postgres dentro de
  // `turnosRepository.reservar`. Acá el fake la imita con una cola y ejecuta el `planificar` real:
  // la segunda reserva decide con la primera ya insertada.
  it('dos reservas simultáneas del último lugar: exactamente una se cumple y la otra da BLOQUE_LLENO', async () => {
    profesores.set(4, { ...profesores.get(4)!, capacidad: 1 })

    const resultados = await Promise.allSettled([
      service.crear({ ...SESION, alumnoId: 12 }, actor),
      service.crear({ ...SESION, alumnoId: 13 }, actor),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazos = resultados.filter((r) => r.status === 'rejected')
    expect(rechazos).toHaveLength(1)
    expect((rechazos[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'BLOQUE_LLENO' })
    expect(turnos).toHaveLength(1)
  })
})

describe('obtener', () => {
  it('devuelve el detalle del turno', async () => {
    guardarTurno({ bloqueAgendaId: 11 })
    const guardado = detalle(turnos[0]!)
    repos.repository.buscarDetalle.mockResolvedValue(guardado)

    expect(await service.obtener(100)).toEqual(guardado)
    expect(repos.repository.buscarDetalle).toHaveBeenCalledWith(100)
  })

  it('inexistente: 404', async () => {
    repos.repository.buscarDetalle.mockResolvedValue(null)
    expect(await errorDe(service.obtener(99))).toBeInstanceOf(NotFoundError)
  })
})

// ---------------------------------------------------------------------------------------------
// Cancelaciones y finalizaciones liberan lugar (T-30, criterio de aceptación)
// ---------------------------------------------------------------------------------------------

describe('crear: una ocurrencia cancelada o fuera del fin efectivo libera su lugar (T-30)', () => {
  it('sesión única en una hora llena con una ocurrencia cancelada esa fecha: se registra', async () => {
    llenar(11, '2026-10-05')
    expect((await errorDe(service.crear(SESION, actor))).code).toBe('BLOQUE_LLENO')

    // Se cancela una de las seis ocurrencias del 05/10: queda un lugar.
    turnos[0] = { ...turnos[0]!, canceladas: ['2026-10-05'] }

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })

  it('sesión única en una hora llena por un recurrente finalizado antes de esa fecha: se registra', async () => {
    llenar(11, '2026-09-28', null)
    expect((await errorDe(service.crear(SESION, actor))).code).toBe('BLOQUE_LLENO')

    // Se finaliza uno de los seis recurrentes desde el 05/10: su fin efectivo es el 04/10.
    turnos[0] = { ...turnos[0]!, finalizadaDesde: '2026-10-05' }

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })

  it('una fecha cancelada del alumno no es superposición', async () => {
    guardarTurno({
      bloqueAgendaId: 20,
      alumnoId: 12,
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-05',
      canceladas: ['2026-10-05'],
    })

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })

  it('un recurrente del alumno finalizado antes del pedido no es superposición', async () => {
    guardarTurno({
      bloqueAgendaId: 20,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-09-28',
      fechaFin: null,
      finalizadaDesde: '2026-10-05',
    })

    expect((await service.crear({ ...RECURRENTE, fechaFin: null }, actor)).cantidad).toBe(1)
  })
})

// ---------------------------------------------------------------------------------------------
// Tope de deuda (HU-29): en los dos caminos
// ---------------------------------------------------------------------------------------------

/** Sesión única del portal: lunes 05/10, 9–10 con Ana. */
const MI_SESION: CrearMiTurno = {
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'SESION_UNICA',
  fechaInicio: '2026-10-05',
  temas: 'Fracciones',
  asignarDondeHayLugar: false,
}

/** Recurrente del portal: los lunes 9–10 del 05/10 al 30/11. */
const MI_RECURRENTE: CrearMiTurno = {
  ...MI_SESION,
  tipo: 'RECURRENTE',
  fechaFin: '2026-11-30',
}

describe('tope de deuda (HU-29)', () => {
  it('mesa: una deuda de hace 30 días bloquea el alta con 409 DEUDA_VENCIDA, cantidad y total', async () => {
    adeudar(HOY_MENOS_30)

    const error = await errorDe(service.crear(SESION, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('DEUDA_VENCIDA')
    expect(error.message).toBe(
      'El alumno tiene deuda de más de 30 días (1 turno · $ 8.000). Debe regularizar el pago para agendar turnos nuevos',
    )
    expect(error.details).toEqual({ cantidad: 1, total: 8000 })
    expect(turnos).toEqual([])
  })

  it('mesa: el mensaje lleva la cantidad y el total de todos los vencidos (3 turnos · $ 24.000)', async () => {
    adeudar('2026-08-09')
    adeudar('2026-08-16')
    adeudar(HOY_MENOS_30)

    const error = await errorDe(service.crear(RECURRENTE, actor))

    expect(error.message).toBe(
      'El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos',
    )
    expect(error.details).toEqual({ cantidad: 3, total: 24000 })
  })

  it('mesa: una deuda de hace 29 días no bloquea', async () => {
    adeudar(HOY_MENOS_29, 91)

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })

  it('portal: una deuda de hace 30 días bloquea con el mensaje para el alumno', async () => {
    adeudar(HOY_MENOS_30)

    const error = await errorDe(service.crearMiTurno(MI_SESION, actorAlumno))

    expect(error.code).toBe('DEUDA_VENCIDA')
    expect(error.message).toBe(
      'Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada',
    )
    expect(error.details).toEqual({ cantidad: 1, total: 8000 })
    expect(turnos).toEqual([])
  })

  it('portal: una deuda de hace 29 días no bloquea', async () => {
    adeudar(HOY_MENOS_29, 91)

    expect((await service.crearMiTurno(MI_SESION, actorAlumno)).cantidad).toBe(1)
  })

  it('un turno pagado, o la deuda de otro alumno, no bloquean', async () => {
    adeudar(HOY_MENOS_30)
    turnosDados[0] = {
      ...turnosDados[0]!,
      pagos: [{ fecha: HOY_MENOS_30, pagoId: 1, importe: 8000 }],
    }
    turnosDados.push({
      id: 600,
      bloqueAgendaId: 90,
      alumnoId: 99,
      materiaId: 3,
      fechaInicio: HOY_MENOS_30,
      fechaFin: HOY_MENOS_30,
    })

    expect((await service.crear(SESION, actor)).cantidad).toBe(1)
  })

  it('se decide antes que la capacidad: con la hora llena y deuda, responde DEUDA_VENCIDA', async () => {
    llenar(11, '2026-10-05')
    adeudar(HOY_MENOS_30)

    expect((await errorDe(service.crear(SESION, actor))).code).toBe('DEUDA_VENCIDA')
  })

  it('se lee dentro de reservar (bajo lock), con el hoy del reloj', async () => {
    await service.crear(SESION, actor)

    const [entrada] = repos.repository.reservar.mock.calls[0]!
    expect(entrada.hoy).toBe('2026-09-22')
  })
})

// ---------------------------------------------------------------------------------------------
// Portal del alumno (HU-29)
// ---------------------------------------------------------------------------------------------

/** Las claves que el alumno no ve nunca (contrato-api.md → Portal del alumno). */
const PROHIBIDAS_PORTAL = [
  'capacidadEfectiva',
  'ocupacion',
  'lleno',
  'prioridad',
  'observaciones',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'dni',
]

/** Todas las claves de un valor JSON, a cualquier profundidad. */
function clavesDe(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(clavesDe)
  if (typeof valor !== 'object' || valor === null) return []
  return Object.entries(valor).flatMap(([clave, v]) => [clave, ...clavesDe(v)])
}

describe('portal: el alumno sale de la sesión', () => {
  const sinAlumno: Actor = { userId: 'usr_alumno_roto', role: 'ALUMNO' }

  it('un actor sin alumno (otro rol o una cuenta ALUMNO sin alumno) → 403 en los cuatro', async () => {
    for (const ajeno of [actor, sinAlumno]) {
      await expect(service.habilitacion(ajeno)).rejects.toBeInstanceOf(ForbiddenError)
      await expect(service.misMaterias(ajeno)).rejects.toBeInstanceOf(ForbiddenError)
      await expect(service.miDisponibilidad({ materiaId: 3 }, ajeno)).rejects.toBeInstanceOf(
        ForbiddenError,
      )
      await expect(service.crearMiTurno(MI_SESION, ajeno)).rejects.toBeInstanceOf(ForbiddenError)
    }
    expect(repos.repository.reservar).not.toHaveBeenCalled()
    expect(repos.repository.deudaVencidaDe).not.toHaveBeenCalled()
  })

  it('un alumnoId de otro alumno en los datos no se usa: el turno es del alumno de la sesión', async () => {
    const datos = { ...MI_SESION, alumnoId: 99 } as CrearMiTurno

    await service.crearMiTurno(datos, actorAlumno)

    expect(turnos).toEqual([expect.objectContaining({ alumnoId: 12 })])
    expect(repos.alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
  })
})

describe('portal: habilitacion', () => {
  it('sin deuda vencida: habilitado y deuda null', async () => {
    repos.repository.deudaVencidaDe.mockResolvedValue({ cantidad: 0, total: 0 })

    expect(await service.habilitacion(actorAlumno)).toEqual({ habilitado: true, deuda: null })
    expect(repos.repository.deudaVencidaDe).toHaveBeenCalledWith(12, '2026-09-22')
  })

  it('con deuda vencida: no habilitado, con la cantidad y el total', async () => {
    repos.repository.deudaVencidaDe.mockResolvedValue({ cantidad: 3, total: 24000 })

    expect(await service.habilitacion(actorAlumno)).toEqual({
      habilitado: false,
      deuda: { cantidad: 3, total: 24000 },
    })
  })
})

describe('portal: misMaterias', () => {
  it('devuelve las materias ofertadas del repository', async () => {
    repos.repository.listarMateriasOfertadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    expect(await service.misMaterias(actorAlumno)).toEqual([{ id: 3, nombre: 'Matemática' }])
  })
})

describe('portal: miDisponibilidad', () => {
  const aula = { id: 3, nombre: 'Aula 3', capacidad: 8 }
  const bloque = (id: number, diaSemana: number, horaInicio: number): BloqueDeProfesor => ({
    id,
    profesorId: 4,
    profesorCapacidad: 6,
    diaSemana,
    horaInicio,
    horaFin: horaInicio + 60,
    aula,
  })
  const conPrecio = (precioHora: number | null) =>
    ({ precioHora }) as Awaited<ReturnType<MateriasRepository['buscarPorId']>>

  beforeEach(() => {
    repos.profesoresRepository.listarProfesoresActivosDeMateria.mockResolvedValue([
      { id: 4, apellido: 'Pérez', nombre: 'Ana', estado: 'ACTIVO' },
    ])
    // Martes 8–9 y 9–10 con Ana; la de 8 está llena.
    repos.bloquesRepository.listarActivasDeProfesores.mockResolvedValue([
      bloque(30, 2, 480),
      bloque(31, 2, 540),
    ])
    repos.repository.contarOcupacionPorBloque.mockImplementation(async (pares) =>
      pares.map((par) => ({ ...par, cantidad: par.bloqueAgendaId === 30 ? 6 : 2 })),
    )
    repos.materiasRepository.buscarPorId.mockResolvedValue(conPrecio(8000))
  })

  it('la misma búsqueda que la mesa, cada hora disponible o no, con el valor por clase y sin cupos', async () => {
    const items = await service.miDisponibilidad({ materiaId: 3 }, actorAlumno)

    expect(items).toEqual([
      {
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        diaSemana: 2,
        // Hoy es martes 22/09: el alumno ve el martes siguiente (desde mañana), no hoy.
        fecha: '2026-09-29',
        aula: { id: 3, nombre: 'Aula 3' },
        horaInicio: '08:00',
        horaFin: '10:00',
        valorPorClase: 8000,
        horas: [
          { bloqueId: 30, horaInicio: '08:00', horaFin: '09:00', disponible: false },
          { bloqueId: 31, horaInicio: '09:00', horaFin: '10:00', disponible: true },
        ],
      },
    ])
    expect(clavesDe(items).filter((clave) => PROHIBIDAS_PORTAL.includes(clave))).toEqual([])
    // La mesa, con la misma búsqueda, ve hoy y los cupos.
    const mesa = await service.disponibilidad({ materiaId: 3 })
    expect(mesa[0]?.fecha).toBe('2026-09-22')
    expect(mesa[0]?.horas[0]).toMatchObject({ capacidadEfectiva: 6, ocupacion: 6, lleno: true })
  })

  it('con fecha: hoy → 400 "Los turnos se sacan desde el día siguiente"; mañana se acepta', async () => {
    const error = await errorDe(
      service.miDisponibilidad({ materiaId: 3, fecha: '2026-09-22' }, actorAlumno),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fecha'], message: 'Los turnos se sacan desde el día siguiente' },
    ])
    await expect(
      service.miDisponibilidad({ materiaId: 3, fecha: '2026-09-23' }, actorAlumno),
    ).resolves.toBeDefined()
  })

  it('materia sin precio: valorPorClase null; sin resultados, [] sin leer la materia', async () => {
    repos.materiasRepository.buscarPorId.mockResolvedValue(conPrecio(null))
    const items = await service.miDisponibilidad({ materiaId: 3 }, actorAlumno)
    expect(items[0]?.valorPorClase).toBe(null)

    repos.materiasRepository.buscarPorId.mockClear()
    repos.bloquesRepository.listarActivasDeProfesores.mockResolvedValue([])
    expect(await service.miDisponibilidad({ materiaId: 3 }, actorAlumno)).toEqual([])
    expect(repos.materiasRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('materia inexistente o inactiva: los mismos 404 y 409 que la mesa', async () => {
    materia = { id: 3, nombre: 'Matemática', estado: 'INACTIVO' }
    const inactiva = await errorDe(service.miDisponibilidad({ materiaId: 3 }, actorAlumno))
    expect(inactiva.code).toBe('MATERIA_INACTIVA')

    materia = null
    const inexistente = await errorDe(service.miDisponibilidad({ materiaId: 3 }, actorAlumno))
    expect(inexistente).toBeInstanceOf(NotFoundError)
  })
})

describe('portal: crearMiTurno', () => {
  it('recurrente: queda ACTIVO sin aprobación, del alumno, creado por su usuario, y responde el resumen', async () => {
    const reservado = await service.crearMiTurno(
      { ...MI_RECURRENTE, fechaFin: null, temas: null },
      actorAlumno,
    )

    expect(turnos).toEqual([
      expect.objectContaining({
        estado: 'ACTIVO',
        alumnoId: 12,
        tipo: 'RECURRENTE',
        fechaInicio: '2026-10-05',
        fechaFin: null,
        observaciones: null,
      }),
    ])
    // El creador es el alumno: `reservar` recibe su actor, con el que el repository completa
    // `createdById` y `updatedById`.
    expect(repos.repository.reservar).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoId: 12 }),
      expect.any(Function),
      actorAlumno,
    )
    expect(reservado).toEqual({
      cantidad: 1,
      tipo: 'RECURRENTE',
      diaSemana: 1,
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      aula: { id: 3, nombre: 'Aula 3' },
      temas: null,
      turnos: [
        {
          id: turnos[0]!.id,
          bloqueId: 11,
          horaInicio: '09:00',
          horaFin: '10:00',
          fechaInicio: '2026-10-05',
          fechaFin: null,
        },
      ],
      fechasSinTurno: [],
    })
  })

  it('la respuesta no trae observaciones, auditoría, cupos, prioridad ni datos del alumno', async () => {
    const reservado = await service.crearMiTurno(MI_SESION, actorAlumno)

    expect(clavesDe(reservado).filter((clave) => PROHIBIDAS_PORTAL.includes(clave))).toEqual([])
    expect(Object.keys(reservado)).not.toContain('alumno')
  })

  it('fecha de hoy → 400 "Los turnos se sacan desde el día siguiente" (sólo en el portal)', async () => {
    const hoyMartes = { ...MI_SESION, bloqueIds: [13], fechaInicio: '2026-09-22' }

    const error = await errorDe(service.crearMiTurno(hoyMartes, actorAlumno))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fechaInicio'], message: 'Los turnos se sacan desde el día siguiente' },
    ])
    expect(repos.repository.reservar).not.toHaveBeenCalled()
    // La mesa sí puede registrar hoy.
    expect((await service.crear({ ...hoyMartes, alumnoId: 12 }, actor)).cantidad).toBe(1)
  })

  it('las reglas de HU-08 valen igual: fecha fuera del día del bloque → 400; materia no asignada → 409', async () => {
    const martes = await errorDe(
      service.crearMiTurno({ ...MI_SESION, fechaInicio: '2026-10-06' }, actorAlumno),
    )
    expect(martes).toBeInstanceOf(ValidationError)

    asignacion = null
    const noAsignada = await errorDe(service.crearMiTurno(MI_SESION, actorAlumno))
    expect(noAsignada.code).toBe('MATERIA_NO_ASIGNADA')
  })

  it('superposición con un turno suyo → 409 ALUMNO_SUPERPUESTO con el mensaje para el alumno', async () => {
    guardarTurno({
      bloqueAgendaId: 20,
      alumnoId: 12,
      tipo: 'RECURRENTE',
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-26',
    })

    const error = await errorDe(service.crearMiTurno(MI_SESION, actorAlumno))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('ALUMNO_SUPERPUESTO')
    expect(error.message).toBe('Ya tenés un turno ese día en ese horario')
    expect(error.details).toEqual([expect.objectContaining({ turnoId: 100, diaSemana: 1 })])
    // La mesa conserva su mensaje.
    expect((await errorDe(service.crear(SESION, actor))).message).toBe(
      'El alumno ya tiene un turno en ese horario',
    )
  })

  it('semanal con fechas llenas: 409 BLOQUE_LLENO con las fechas (sin cupos); "Reservar sólo las fechas con lugar" crea los tramos', async () => {
    llenar(11, '2026-10-26')

    const error = await errorDe(service.crearMiTurno(MI_RECURRENTE, actorAlumno))
    expect(error.code).toBe('BLOQUE_LLENO')
    expect(error.details).toEqual([
      {
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        fechas: ['2026-10-26'],
        completoDesde: null,
        sinLugar: false,
      },
    ])

    const reservado = await service.crearMiTurno(
      { ...MI_RECURRENTE, asignarDondeHayLugar: true },
      actorAlumno,
    )
    expect(reservado.cantidad).toBe(2)
    expect(reservado.turnos.map((t) => [t.fechaInicio, t.fechaFin])).toEqual([
      ['2026-10-05', '2026-10-19'],
      ['2026-11-02', '2026-11-30'],
    ])
    expect(reservado.fechasSinTurno).toEqual([
      {
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        fechas: ['2026-10-26'],
        completoDesde: null,
      },
    ])
  })

  it('sesión única en una hora llena: 409 BLOQUE_LLENO sin la capacidad', async () => {
    llenar(11, '2026-10-05')

    const error = await errorDe(service.crearMiTurno(MI_SESION, actorAlumno))
    expect(error.code).toBe('BLOQUE_LLENO')
    expect(clavesDe(error.details)).not.toContain('capacidadEfectiva')
  })
})
