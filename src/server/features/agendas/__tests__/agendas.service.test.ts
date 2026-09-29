import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, NotFoundError, ValidationError } from '@/server/errors'
import type { AulasRepository } from '@/server/features/aulas/aulas.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { AgendasRepository, Ocurrencia } from '../agendas.repository'
import { MENSAJE_RANGO_INVERTIDO, MENSAJE_RANGO_MAXIMO } from '../agendas.reglas'
import { crearAgendasService } from '../agendas.service'

// Las agendas (se movieron de `turnos` en T-30, verificando lo mismo que antes). Los repositories
// se reemplazan por falsos: el de agendas devuelve ocurrencias como las arma el motor (ya
// filtradas por el filtro que recibe) y el service filtra, ordena y pagina.

// Mediodía del martes 22/09/2026 en Salta (UTC-3). Los lunes siguientes: 28/09, 05/10, 12/10…
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

/** Una ocurrencia como la arma el motor (horas en minutos). */
function ocurrencia(
  datos: Partial<Ocurrencia> & Pick<Ocurrencia, 'turnoId' | 'fecha'>,
): Ocurrencia {
  return {
    bloqueAgendaId: 10,
    diaSemana: 1,
    horaInicio: 540,
    horaFin: 600,
    profesorId: 4,
    aulaId: 3,
    alumnoId: 12,
    materiaId: 3,
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    pago: { estado: 'PENDIENTE' },
    serie: { fechaInicio: datos.fecha, fechaFin: null, finEfectivo: null },
    alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    ...datos,
  }
}

const ruiz = { id: 7, nombre: 'Juan', apellido: 'Ruiz', busqueda: 'ruiz juan 30222333' }
const alvarez = { id: 9, nombre: 'Bruno', apellido: 'Álvarez', busqueda: 'alvarez bruno 30444555' }

function crearRepositories() {
  return {
    repository: { leerOcurrencias: vi.fn<AgendasRepository['leerOcurrencias']>() },
    profesoresRepository: {
      buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>(),
      buscarConAsignaciones: vi.fn<ProfesoresRepository['buscarConAsignaciones']>(),
    },
    aulasRepository: { listar: vi.fn<AulasRepository['listar']>() },
  }
}

let repos: ReturnType<typeof crearRepositories>
let service: ReturnType<typeof crearAgendasService>

beforeEach(() => {
  repos = crearRepositories()
  service = crearAgendasService({ ...repos, reloj: relojFijo })
  repos.repository.leerOcurrencias.mockResolvedValue([])
  repos.aulasRepository.listar.mockResolvedValue([])
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
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

describe('listarAgenda', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20 })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      {
        desde: HOY,
        hasta: HOY,
        materiaId: undefined,
        aulaId: undefined,
        profesorId: undefined,
      },
      relojFijo,
    )
  })

  it('con fecha, la respeta en lugar de la de hoy', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20, fecha: '2026-09-28' })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      expect.objectContaining({ desde: '2026-09-28', hasta: '2026-09-28' }),
      relojFijo,
    )
  })

  it('pasa los filtros de materia, aula y profesor tal cual', async () => {
    await service.listarAgenda({ page: 2, pageSize: 10, materiaId: 2, aulaId: 1, profesorId: 3 })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: HOY, hasta: HOY, materiaId: 2, aulaId: 1, profesorId: 3 },
      relojFijo,
    )
  })

  it('arma cada item campo por campo (horas en HH:mm, estado ACTIVO), sin las canceladas', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 15, fecha: HOY }),
      ocurrencia({ turnoId: 16, fecha: HOY, estado: 'CANCELADO' }),
    ])

    await expect(service.listarAgenda({ page: 1, pageSize: 20 })).resolves.toEqual({
      data: [
        {
          id: 15,
          alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
          profesor: { id: 4, apellido: 'Pérez', nombre: 'Ana' },
          materia: { id: 3, nombre: 'Matemática' },
          aula: { id: 3, nombre: 'Aula 3' },
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'ACTIVO',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })
  })

  it('una ocurrencia pasada del día (SIN_REGISTRAR) se sigue mostrando', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 15, fecha: '2026-09-21', estado: 'SIN_REGISTRAR' }),
    ])

    const pagina = await service.listarAgenda({ page: 1, pageSize: 20, fecha: '2026-09-21' })
    expect(pagina.data.map((item) => item.id)).toEqual([15])
  })

  it('ordena por hora, dentro de la hora por profesor (su busqueda) y por id del turno', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 30, fecha: HOY, horaInicio: 600, horaFin: 660 }),
      ocurrencia({ turnoId: 21, fecha: HOY, profesor: ruiz }),
      ocurrencia({ turnoId: 20, fecha: HOY, profesor: ruiz }),
      ocurrencia({ turnoId: 25, fecha: HOY, profesor: alvarez }),
      ocurrencia({ turnoId: 22, fecha: HOY }),
    ])

    const pagina = await service.listarAgenda({ page: 1, pageSize: 20 })
    expect(pagina.data.map((item) => item.id)).toEqual([25, 22, 20, 21, 30])
  })

  it('pagina en memoria con calcularSkipTake y arma meta con armarMeta', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ocurrencia({ turnoId: i + 1, fecha: HOY })),
    )

    const pagina = await service.listarAgenda({ page: 2, pageSize: 2 })
    expect(pagina.data.map((item) => item.id)).toEqual([3, 4])
    expect(pagina.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 })
  })

  it('normaliza `q` (terminosDeBusqueda): todas las palabras en el alumno o todas en el profesor', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }), // alumna González, profesora Pérez
      ocurrencia({ turnoId: 2, fecha: HOY, profesor: ruiz }),
    ])

    const porAlumno = await service.listarAgenda({ page: 1, pageSize: 20, q: 'GONZ lucía' })
    expect(porAlumno.data.map((item) => item.id)).toEqual([1, 2])

    const porProfesor = await service.listarAgenda({ page: 1, pageSize: 20, q: 'ruiz' })
    expect(porProfesor.data.map((item) => item.id)).toEqual([2])

    // Mezcladas entre alumno y profesor no coinciden (T-36).
    const mezcladas = await service.listarAgenda({ page: 1, pageSize: 20, q: 'gonzalez ruiz' })
    expect(mezcladas.data).toEqual([])
  })

  it('con profesorId, `q` busca sólo por alumno (T-42)', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([ocurrencia({ turnoId: 1, fecha: HOY })])

    const porProfesor = await service.listarAgenda({
      page: 1,
      pageSize: 20,
      q: 'perez',
      profesorId: 4,
    })
    expect(porProfesor.data).toEqual([])
    const porAlumno = await service.listarAgenda({
      page: 1,
      pageSize: 20,
      q: 'gonzalez',
      profesorId: 4,
    })
    expect(porAlumno.data.map((item) => item.id)).toEqual([1])
  })

  it('sin turnos ese día, devuelve una página vacía', async () => {
    await expect(service.listarAgenda({ page: 1, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Agenda propia del profesor (HU-10)
// ---------------------------------------------------------------------------------------------

describe('listarAgendaPropia', () => {
  const MARTES = HOY
  const LUNES = '2026-09-28'
  const actorProfesor: Actor = { userId: 'usr_ana', role: 'PROFESOR' }

  beforeEach(() => {
    repos.profesoresRepository.buscarIdPorUsuario.mockImplementation(async (usuarioId) =>
      usuarioId === 'usr_ana' ? 4 : null,
    )
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({
        turnoId: 32,
        fecha: MARTES,
        diaSemana: 2,
        tipo: 'SESION_UNICA',
        alumno: { id: 13, nombre: 'Lucía', apellido: 'González', busqueda: 'x' },
      }),
      ocurrencia({ turnoId: 31, fecha: LUNES }),
      ocurrencia({ turnoId: 33, fecha: LUNES, estado: 'CANCELADO' }),
    ])
  })

  it('el profesor sale del actor: le pide al repository su id, no uno de la entrada', async () => {
    await service.listarAgendaPropia({}, actorProfesor)

    expect(repos.profesoresRepository.buscarIdPorUsuario).toHaveBeenCalledWith('usr_ana')
    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: HOY, hasta: HOY, profesorId: 4 },
      relojFijo,
    )
  })

  it('arma cada ocurrencia campo por campo, sin las canceladas, en el orden del motor', async () => {
    const agenda = await service.listarAgendaPropia({ desde: MARTES, hasta: LUNES }, actorProfesor)

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
      expect.objectContaining({ turnoId: 31, fecha: LUNES, tipo: 'RECURRENTE' }),
    ])
  })

  it('sin hasta, un solo día', async () => {
    await service.listarAgendaPropia({ desde: '2026-09-30' }, actorProfesor)
    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2026-09-30', hasta: '2026-09-30', profesorId: 4 },
      relojFijo,
    )
  })

  it('un usuario sin ficha de profesor → 404', async () => {
    const error = await errorDe(
      service.listarAgendaPropia({}, { userId: 'usr_sin_ficha', role: 'PROFESOR' }),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
  })

  it('`hasta` anterior a `desde` → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaPropia({ desde: LUNES, hasta: MARTES }, actorProfesor),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
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
  const LUNES = '2026-09-28'

  beforeEach(() => {
    repos.profesoresRepository.buscarConAsignaciones.mockImplementation(async (profesorId) =>
      profesorId === 7 ? { estado: 'ACTIVO', asignaciones: [] } : null,
    )
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 90, fecha: LUNES, profesorId: 7, profesor: ruiz }),
      ocurrencia({ turnoId: 90, fecha: '2026-10-05', profesorId: 7, profesor: ruiz }),
    ])
  })

  it('devuelve las ocurrencias del profesor pedido, con la forma de la agenda propia', async () => {
    const agenda = await service.listarAgendaDeProfesor({
      profesorId: 7,
      desde: LUNES,
      hasta: '2026-10-05',
    })

    expect(repos.profesoresRepository.buscarConAsignaciones).toHaveBeenCalledWith(7, [])
    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: LUNES, hasta: '2026-10-05', profesorId: 7 },
      relojFijo,
    )
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

    expect(agenda.map((item) => item.turnoId)).toEqual([90, 90])
  })

  it('sin desde ni hasta, el día de hoy', async () => {
    await service.listarAgendaDeProfesor({ profesorId: 7 })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: HOY, hasta: HOY, profesorId: 7 },
      relojFijo,
    )
  })

  it('un profesor inexistente → 404, sin leer la agenda', async () => {
    const error = await errorDe(service.listarAgendaDeProfesor({ profesorId: 99 }))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
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
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
  })

  it('un rango mayor al máximo → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES, hasta: '2026-10-29' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }])
  })
})

// ---------------------------------------------------------------------------------------------
// Selectores de materias y aulas
// ---------------------------------------------------------------------------------------------

describe('listarMateriasConTurno', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarMateriasConTurno({})

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: HOY, hasta: HOY },
      relojFijo,
    )
  })

  it('materias de las ocurrencias no canceladas, sin repetir, por nombre sin tildes e id', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: '2026-09-28', materia: { id: 2, nombre: 'Matemática' } }),
      ocurrencia({ turnoId: 2, fecha: '2026-09-28', materia: { id: 7, nombre: 'Física' } }),
      ocurrencia({ turnoId: 3, fecha: '2026-09-28', materia: { id: 2, nombre: 'Matemática' } }),
      ocurrencia({ turnoId: 4, fecha: '2026-09-28', materia: { id: 5, nombre: 'Álgebra' } }),
      ocurrencia({
        turnoId: 5,
        fecha: '2026-09-28',
        materia: { id: 8, nombre: 'Química' },
        estado: 'CANCELADO',
      }),
    ])

    await expect(service.listarMateriasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([
      { id: 5, nombre: 'Álgebra' },
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ])
    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: '2026-09-28', hasta: '2026-09-28' },
      relojFijo,
    )
  })

  it('sin materias con turno ese día, devuelve un arreglo vacío', async () => {
    await expect(service.listarMateriasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([])
  })
})

describe('listarAulasConTurno', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarAulasConTurno({})

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: HOY, hasta: HOY },
      relojFijo,
    )
  })

  it('aulas usadas por ocurrencias no canceladas, en el orden del catálogo, sin filtrar por estado', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: '2026-09-28', aula: { id: 2, nombre: 'Aula 2' } }),
      ocurrencia({ turnoId: 2, fecha: '2026-09-28', aula: { id: 1, nombre: 'Aula 1' } }),
      ocurrencia({
        turnoId: 3,
        fecha: '2026-09-28',
        aula: { id: 4, nombre: 'Aula 4' },
        estado: 'CANCELADO',
      }),
    ])
    repos.aulasRepository.listar.mockResolvedValue([
      { id: 1, nombre: 'Aula 1', capacidad: 6, estado: 'ACTIVO' },
      { id: 2, nombre: 'Aula 2', capacidad: 6, estado: 'INACTIVO' },
      { id: 3, nombre: 'Aula 3', capacidad: 6, estado: 'ACTIVO' },
      { id: 4, nombre: 'Aula 4', capacidad: 6, estado: 'ACTIVO' },
    ])

    await expect(service.listarAulasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ])
  })

  it('sin aulas con turno ese día, devuelve un arreglo vacío (sin leer el catálogo)', async () => {
    await expect(service.listarAulasConTurno({ fecha: '2026-09-28' })).resolves.toEqual([])
    expect(repos.aulasRepository.listar).not.toHaveBeenCalled()
  })
})
