import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { AlumnoGuardado } from '@/server/features/alumnos/alumnos.validation'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { BloqueDeProfesor } from '@/server/features/bloques/bloques.validation'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { Estado } from '@/server/shared/estado'
import { minutosAHora } from '@/server/shared/zod'
import type { TurnosRepository } from '../turnos.repository'
import { MENSAJE_RANGO_INVERTIDO, MENSAJE_RANGO_MAXIMO, seCruzaCon } from '../turnos.reglas'
import { crearTurnosService } from '../turnos.service'
import type {
  AgendaListado,
  CrearTurno,
  FilaBloqueado,
  SnapshotReserva,
  TipoTurno,
  TurnoDetalle,
} from '../turnos.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El de turnos es un fake en
// memoria que arma el snapshot como el real y ejecuta el `planificar` verdadero (el de
// `turnos.reglas.ts`), así las reglas del alta se prueban de punta a punta. El service los importa
// solo como tipo.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

// Mediodía del martes 22/09/2026 en Salta (UTC-3). Los lunes siguientes: 28/09, 05/10, 12/10…
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const paginaVacia: AgendaListado = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
}

// ---------------------------------------------------------------------------------------------
// Base en memoria
// ---------------------------------------------------------------------------------------------

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
    motivoConsulta: null,
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
      const snapshot: SnapshotReserva = {
        filas: elegidas.map((f) => ({ ...f })),
        profesor: profesor
          ? { id: profesor.id, capacidad: profesor.capacidad, estado: profesor.estado }
          : null,
        materia: materia && { id: materia.id, estado: materia.estado },
        asignacion,
        ocupantes: turnos.filter(
          (t) =>
            entrada.bloqueIds.includes(t.bloqueAgendaId) &&
            seCruzaCon(t, entrada.fechaInicio, entrada.fechaFin),
        ),
        turnosAlumno: turnos
          .filter((t) => t.alumnoId === entrada.alumnoId)
          .flatMap((t) => {
            const f = filas.find((x) => x.id === t.bloqueAgendaId)
            const mismaHora = elegidas.some(
              (e) => f && e.diaSemana === f.diaSemana && e.horaInicio === f.horaInicio,
            )
            if (!f || !mismaHora || !seCruzaCon(t, entrada.fechaInicio, entrada.fechaFin)) return []
            const p = profesores.get(f.profesorId)
            return [
              {
                ...t,
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
      listarAgenda: vi.fn<TurnosRepository['listarAgenda']>(),
      listarAgendaPropia: vi.fn<TurnosRepository['listarAgendaPropia']>(),
      listarMateriasConTurno: vi.fn<TurnosRepository['listarMateriasConTurno']>(),
      listarAulasConTurno: vi.fn<TurnosRepository['listarAulasConTurno']>(),
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
      buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>(),
    },
    materiasRepository: { buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>() },
  }
}

let repos: ReturnType<typeof crearRepositories>
let service: ReturnType<typeof crearTurnosService>

beforeEach(() => {
  sembrar()
  repos = crearRepositories()
  service = crearTurnosService({ ...repos, reloj: relojFijo })

  repos.repository.reservar.mockImplementation(crearReservarEnMemoria())
  repos.repository.contarOcupacionPorBloque.mockResolvedValue([])
  repos.repository.listarAgenda.mockResolvedValue(paginaVacia)
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
    const alta = await service.crear({ ...SESION, motivoConsulta: 'Repaso' }, actor)

    expect(alta.cantidad).toBe(1)
    expect(alta.turnos.map(resumen)).toEqual([[11, 'SESION_UNICA', '2026-10-05', '2026-10-05']])
    expect(alta.fechasSinTurno).toEqual([])
    expect(turnos).toEqual([
      expect.objectContaining({
        estado: 'ACTIVO',
        alumnoId: 12,
        materiaId: 3,
        motivoConsulta: 'Repaso',
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
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

describe('listarAgenda', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20 })

    expect(repos.repository.listarAgenda).toHaveBeenCalledWith({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      materiaId: undefined,
      aulaId: undefined,
      profesorId: undefined,
      terminos: [],
    })
  })

  it('con fecha, la respeta en lugar de la de hoy', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20, fecha: '2026-09-28' })

    expect(repos.repository.listarAgenda).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: '2026-09-28' }),
    )
  })

  it('pasa la paginación y los filtros de materia, aula y profesor tal cual', async () => {
    await service.listarAgenda({
      page: 2,
      pageSize: 10,
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
    })

    expect(repos.repository.listarAgenda).toHaveBeenCalledWith({
      fecha: HOY,
      page: 2,
      pageSize: 10,
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
      terminos: [],
    })
  })

  it('normaliza `q` con terminosDeBusqueda antes de pasarlo al repository', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20, q: 'gonz pérez' })

    expect(repos.repository.listarAgenda).toHaveBeenCalledWith(
      expect.objectContaining({ terminos: ['gonz', 'perez'] }),
    )
  })

  it('devuelve la página tal como la arma el repository', async () => {
    const pagina: AgendaListado = {
      data: [
        {
          id: 15,
          alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
          profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
          materia: { id: 2, nombre: 'Matemática' },
          aula: { id: 1, nombre: 'Aula 1' },
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'ACTIVO',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }
    repos.repository.listarAgenda.mockResolvedValue(pagina)

    await expect(service.listarAgenda({ page: 1, pageSize: 20 })).resolves.toEqual(pagina)
  })
})

// ---------------------------------------------------------------------------------------------
// Agenda propia del profesor (HU-10)
// ---------------------------------------------------------------------------------------------

describe('listarAgendaPropia', () => {
  // HOY (22/09/2026) es martes; los lunes siguientes son 28/09, 05/10…
  const MARTES = HOY
  const LUNES = '2026-09-28'
  const actorProfesor: Actor = { userId: 'usr_ana', role: 'PROFESOR' }

  /** Turnos de dos profesores: el fake del repository filtra como lo hace la consulta real. */
  function sembrarAgenda() {
    turnos.push(
      // Ana (profesor 4): recurrente sin fin los lunes 9–10 y una sesión única de hoy (martes).
      {
        id: 31,
        bloqueAgendaId: 11,
        alumnoId: 12,
        materiaId: 3,
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
        fechaInicio: LUNES,
        fechaFin: null,
      },
      {
        id: 32,
        bloqueAgendaId: 13,
        alumnoId: 13,
        materiaId: 3,
        tipo: 'SESION_UNICA',
        estado: 'ACTIVO',
        fechaInicio: MARTES,
        fechaFin: MARTES,
      },
      // Juan (profesor 7): mismo lunes, misma hora. No tiene que salir en la agenda de Ana.
      {
        id: 90,
        bloqueAgendaId: 20,
        alumnoId: 12,
        materiaId: 3,
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
        fechaInicio: LUNES,
        fechaFin: null,
      },
    )
  }

  beforeEach(() => {
    sembrarAgenda()
    repos.profesoresRepository.buscarIdPorUsuario.mockImplementation(async (usuarioId) =>
      usuarioId === 'usr_ana' ? 4 : null,
    )
    // Filtra por profesor y por cruce con el rango, como `listarAgendaPropia` del repository.
    repos.repository.listarAgendaPropia.mockImplementation(async ({ profesorId, desde, hasta }) =>
      turnos
        .flatMap((turno) => {
          const bloque = filas.find((f) => f.id === turno.bloqueAgendaId)
          return bloque && bloque.profesorId === profesorId ? [{ turno, bloque }] : []
        })
        .filter(({ turno }) => seCruzaCon(turno, desde, hasta))
        .sort((a, b) => a.bloque.horaInicio - b.bloque.horaInicio || a.turno.id - b.turno.id)
        .map(({ turno, bloque }) => ({
          id: turno.id,
          tipo: turno.tipo,
          estado: turno.estado,
          fechaInicio: turno.fechaInicio,
          fechaFin: turno.fechaFin,
          diaSemana: bloque.diaSemana,
          horaInicio: minutosAHora(bloque.horaInicio),
          horaFin: minutosAHora(bloque.horaFin),
          alumno: { id: turno.alumnoId, apellido: 'González', nombre: 'Lucía' },
          materia: { id: turno.materiaId, nombre: 'Matemática' },
          aula: { id: 3, nombre: 'Aula 3' },
        })),
    )
  })

  it('el profesor sale del actor: le pide al repository su id, no uno de la entrada', async () => {
    await service.listarAgendaPropia({}, actorProfesor)

    expect(repos.profesoresRepository.buscarIdPorUsuario).toHaveBeenCalledWith('usr_ana')
    expect(repos.repository.listarAgendaPropia).toHaveBeenCalledWith({
      profesorId: 4,
      desde: HOY,
      hasta: HOY,
    })
  })

  it('devuelve solo los turnos del profesor de la sesión, no los de otro', async () => {
    const agenda = await service.listarAgendaPropia({ desde: LUNES, hasta: LUNES }, actorProfesor)

    expect(agenda.map((item) => item.turnoId)).toEqual([31])
  })

  it('sin desde ni hasta, la agenda del día de hoy', async () => {
    const agenda = await service.listarAgendaPropia({}, actorProfesor)

    expect(agenda).toEqual([
      {
        turnoId: 32,
        fecha: MARTES,
        diaSemana: 2,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 13, apellido: 'González', nombre: 'Lucía' },
        materia: { id: 3, nombre: 'Matemática' },
        aula: { id: 3, nombre: 'Aula 3' },
        tipo: 'SESION_UNICA',
        estado: 'ACTIVO',
      },
    ])
  })

  it('sin hasta, un solo día: el recurrente no aparece en los días que no son el suyo', async () => {
    await expect(
      service.listarAgendaPropia({ desde: '2026-09-30' }, actorProfesor),
    ).resolves.toEqual([])
  })

  it('un rango de una semana trae cada día con lo que le corresponde', async () => {
    const agenda = await service.listarAgendaPropia(
      { desde: MARTES, hasta: '2026-09-28' },
      actorProfesor,
    )

    expect(agenda.map((item) => [item.fecha, item.turnoId])).toEqual([
      [MARTES, 32],
      [LUNES, 31],
    ])
  })

  it('un recurrente aparece una vez por semana dentro del rango', async () => {
    const agenda = await service.listarAgendaPropia(
      { desde: LUNES, hasta: '2026-10-12' },
      actorProfesor,
    )

    expect(agenda.map((item) => item.fecha)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })

  it('un usuario sin ficha de profesor → 404', async () => {
    const error = await errorDe(
      service.listarAgendaPropia({}, { userId: 'usr_sin_ficha', role: 'PROFESOR' }),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.listarAgendaPropia).not.toHaveBeenCalled()
  })

  it('`hasta` anterior a `desde` → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaPropia({ desde: LUNES, hasta: MARTES }, actorProfesor),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.repository.listarAgendaPropia).not.toHaveBeenCalled()
  })

  it('un rango mayor al máximo → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaPropia({ desde: LUNES, hasta: '2026-10-29' }, actorProfesor),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }])
  })
})

// ---------------------------------------------------------------------------------------------
// Agenda de un profesor para mesa de entradas (T-44)
// ---------------------------------------------------------------------------------------------

describe('listarAgendaDeProfesor', () => {
  // HOY (22/09/2026) es martes; los lunes siguientes son 28/09, 05/10…
  const LUNES = '2026-09-28'

  /** Recurrente sin fin de Juan (profesor 7) los lunes 9–10, tal como lo devuelve el repository. */
  const recurrenteDeJuan = {
    id: 90,
    tipo: 'RECURRENTE' as const,
    estado: 'ACTIVO' as const,
    fechaInicio: LUNES,
    fechaFin: null,
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
  }

  beforeEach(() => {
    repos.profesoresRepository.buscarConAsignaciones.mockImplementation(async (profesorId) =>
      profesorId === 7 ? { estado: 'ACTIVO', asignaciones: [] } : null,
    )
    repos.repository.listarAgendaPropia.mockResolvedValue([recurrenteDeJuan])
  })

  it('devuelve las ocurrencias del profesor pedido, con la forma de la agenda propia', async () => {
    const agenda = await service.listarAgendaDeProfesor({
      profesorId: 7,
      desde: LUNES,
      hasta: '2026-10-05',
    })

    expect(repos.profesoresRepository.buscarConAsignaciones).toHaveBeenCalledWith(7, [])
    expect(repos.repository.listarAgendaPropia).toHaveBeenCalledWith({
      profesorId: 7,
      desde: LUNES,
      hasta: '2026-10-05',
    })
    expect(agenda).toEqual([
      {
        turnoId: 90,
        fecha: LUNES,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
        materia: { id: 3, nombre: 'Matemática' },
        aula: { id: 3, nombre: 'Aula 3' },
        tipo: 'RECURRENTE',
        estado: 'ACTIVO',
      },
      expect.objectContaining({ turnoId: 90, fecha: '2026-10-05' }),
    ])
  })

  it('un profesor inactivo también se puede consultar', async () => {
    repos.profesoresRepository.buscarConAsignaciones.mockResolvedValue({
      estado: 'INACTIVO',
      asignaciones: [],
    })

    const agenda = await service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES })

    expect(agenda.map((item) => [item.fecha, item.turnoId])).toEqual([[LUNES, 90]])
  })

  it('sin desde ni hasta, el día de hoy', async () => {
    await service.listarAgendaDeProfesor({ profesorId: 7 })

    expect(repos.repository.listarAgendaPropia).toHaveBeenCalledWith({
      profesorId: 7,
      desde: HOY,
      hasta: HOY,
    })
  })

  it('sin hasta, el mismo día que desde', async () => {
    await service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES })

    expect(repos.repository.listarAgendaPropia).toHaveBeenCalledWith({
      profesorId: 7,
      desde: LUNES,
      hasta: LUNES,
    })
  })

  it('un profesor inexistente → 404, sin leer la agenda', async () => {
    const error = await errorDe(service.listarAgendaDeProfesor({ profesorId: 99 }))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.listarAgendaPropia).not.toHaveBeenCalled()
  })

  it('el 404 va antes que la validación del rango', async () => {
    const error = await errorDe(
      service.listarAgendaDeProfesor({ profesorId: 99, desde: LUNES, hasta: HOY }),
    )

    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('`hasta` anterior a `desde` → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES, hasta: HOY }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.repository.listarAgendaPropia).not.toHaveBeenCalled()
  })

  it('un rango mayor al máximo → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES, hasta: '2026-10-29' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }])
  })
})

describe('listarMateriasConTurno', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarMateriasConTurno({})

    expect(repos.repository.listarMateriasConTurno).toHaveBeenCalledWith(HOY)
  })

  it('pide al repository las materias con turno de la fecha pedida', async () => {
    const materias = [
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ]
    repos.repository.listarMateriasConTurno.mockResolvedValue(materias)

    await expect(service.listarMateriasConTurno({ fecha: '2026-09-28' })).resolves.toEqual(materias)
    expect(repos.repository.listarMateriasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin materias con turno ese día, devuelve un arreglo vacío', async () => {
    repos.repository.listarMateriasConTurno.mockResolvedValue([])

    await expect(service.listarMateriasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([])
  })
})

describe('listarAulasConTurno', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarAulasConTurno({})

    expect(repos.repository.listarAulasConTurno).toHaveBeenCalledWith(HOY)
  })

  it('pide al repository las aulas con turno de la fecha pedida', async () => {
    const aulas = [
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ]
    repos.repository.listarAulasConTurno.mockResolvedValue(aulas)

    await expect(service.listarAulasConTurno({ fecha: '2026-09-28' })).resolves.toEqual(aulas)
    expect(repos.repository.listarAulasConTurno).toHaveBeenCalledWith('2026-09-28')
  })

  it('sin aulas con turno ese día, devuelve un arreglo vacío', async () => {
    repos.repository.listarAulasConTurno.mockResolvedValue([])

    await expect(service.listarAulasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([])
  })
})
