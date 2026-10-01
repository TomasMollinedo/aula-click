import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, NotFoundError, ValidationError } from '@/server/errors'
import type { AulasRepository } from '@/server/features/aulas/aulas.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { PrioridadDeTurno } from '@/server/features/examenes/examenes.condiciones'
import type { AgendasRepository, Ocurrencia } from '../agendas.repository'
import { MENSAJE_RANGO_INVERTIDO, MENSAJE_RANGO_MAXIMO } from '../agendas.reglas'
import { claveOcupacion } from '@/server/features/turnos/ocurrencias.condiciones'
import { crearAgendasService } from '../agendas.service'

// Las agendas (se movieron de `turnos` en T-30; T-57 las pasó a ocurrencias con estado, pago y
// prioridad, e incluyó las canceladas). Los repositories se reemplazan por falsos: el de agendas
// devuelve ocurrencias como las arma el motor (ya filtradas por el filtro que recibe) y las
// prioridades como las arma `leerPrioridades`; el service filtra, ordena y pagina.

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

/** Cupo por defecto de toda clase pedida: 1 lugar ocupado de 4 (el repository devuelve uno por clase). */
function cupos(clases: readonly { bloqueAgendaId: number; fecha: string }[]) {
  return new Map(
    clases.map(({ bloqueAgendaId, fecha }) => [
      claveOcupacion(bloqueAgendaId, fecha),
      { ocupados: 1, capacidad: 4 },
    ]),
  )
}

/** Prioridades que devuelve el repository, por `alumnoId-materiaId-fecha` (`clavePrioridad`). */
function prioridades(
  ...entradas: [alumnoId: number, materiaId: number, fecha: string, PrioridadDeTurno][]
) {
  return new Map(
    entradas.map(([alumnoId, materiaId, fecha, prioridad]) => [
      `${alumnoId}-${materiaId}-${fecha}`,
      prioridad,
    ]),
  )
}

const examen: NonNullable<PrioridadDeTurno['examen']> = {
  id: 5,
  fecha: '2026-09-25',
  tipo: 'PARCIAL',
  materiaNombre: 'Matemática',
  dias: 3,
}

const ruiz = { id: 7, nombre: 'Juan', apellido: 'Ruiz', busqueda: 'ruiz juan 30222333' }
const alvarez = { id: 9, nombre: 'Bruno', apellido: 'Álvarez', busqueda: 'alvarez bruno 30444555' }

function crearRepositories() {
  return {
    repository: {
      leerOcurrencias: vi.fn<AgendasRepository['leerOcurrencias']>(),
      leerPrioridades: vi.fn<AgendasRepository['leerPrioridades']>(),
      leerCupos: vi.fn<AgendasRepository['leerCupos']>(),
    },
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
  repos.repository.leerPrioridades.mockResolvedValue(new Map())
  repos.repository.leerCupos.mockImplementation(async (clases) => cupos(clases))
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

  it('arma cada ítem campo por campo (horas en HH:mm, estado, pago y prioridad), sin `busqueda`', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({
        turnoId: 15,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 9, importeAplicado: 5000 },
      }),
    ])
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades([12, 3, HOY, { prioridad: 'ALTA', examen }]),
    )

    const pagina = await service.listarAgenda({ page: 1, pageSize: 20 })

    expect(pagina).toEqual({
      data: [
        {
          turnoId: 15,
          fecha: HOY,
          bloqueAgendaId: 10,
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '10:00',
          alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
          profesor: { id: 4, apellido: 'Pérez', nombre: 'Ana' },
          materia: { id: 3, nombre: 'Matemática' },
          aula: { id: 3, nombre: 'Aula 3' },
          tipo: 'RECURRENTE',
          estado: 'AGENDADO',
          estadoPago: 'PAGADO',
          prioridad: 'ALTA',
          examen,
          cupo: { ocupados: 1, capacidad: 4 },
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })
    expect(JSON.stringify(pagina)).not.toContain('busqueda')
  })

  it('incluye las canceladas, con su estado y sin prioridad ni consulta de prioridad (HU-13, T-57)', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 15, fecha: HOY }),
      ocurrencia({ turnoId: 16, fecha: HOY, alumnoId: 13, estado: 'CANCELADO' }),
    ])
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades([12, 3, HOY, { prioridad: 'MEDIA' }]),
    )

    const pagina = await service.listarAgenda({ page: 1, pageSize: 20 })

    expect(pagina.data).toEqual([
      expect.objectContaining({ turnoId: 15, estado: 'AGENDADO', prioridad: 'MEDIA' }),
      expect.objectContaining({
        turnoId: 16,
        estado: 'CANCELADO',
        estadoPago: 'PENDIENTE',
        prioridad: null,
        examen: null,
      }),
    ])
    // Sólo se pide la prioridad de la que no está cancelada: una sola consulta, para el lote.
    expect(repos.repository.leerPrioridades).toHaveBeenCalledTimes(1)
    expect(repos.repository.leerPrioridades).toHaveBeenCalledWith([
      { alumnoId: 12, materiaId: 3, fecha: HOY },
    ])
  })

  it('una ocurrencia pasada del día (SIN_REGISTRAR) se sigue mostrando', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 15, fecha: '2026-09-21', estado: 'SIN_REGISTRAR' }),
    ])

    const pagina = await service.listarAgenda({ page: 1, pageSize: 20, fecha: '2026-09-21' })
    expect(pagina.data.map((item) => item.turnoId)).toEqual([15])
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
    expect(pagina.data.map((item) => item.turnoId)).toEqual([25, 22, 20, 21, 30])
  })

  it('pagina en memoria con calcularSkipTake y arma meta con armarMeta', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ocurrencia({ turnoId: i + 1, fecha: HOY })),
    )

    const pagina = await service.listarAgenda({ page: 2, pageSize: 2 })
    expect(pagina.data.map((item) => item.turnoId)).toEqual([3, 4])
    expect(pagina.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 })
  })

  it('normaliza `q` (terminosDeBusqueda): todas las palabras en el alumno o todas en el profesor', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }), // alumna González, profesora Pérez
      ocurrencia({ turnoId: 2, fecha: HOY, profesor: ruiz }),
    ])

    const porAlumno = await service.listarAgenda({ page: 1, pageSize: 20, q: 'GONZ lucía' })
    expect(porAlumno.data.map((item) => item.turnoId)).toEqual([1, 2])

    const porProfesor = await service.listarAgenda({ page: 1, pageSize: 20, q: 'ruiz' })
    expect(porProfesor.data.map((item) => item.turnoId)).toEqual([2])

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
    expect(porAlumno.data.map((item) => item.turnoId)).toEqual([1])
  })

  describe('filtros por estado y prioridad (T-57)', () => {
    beforeEach(() => {
      repos.repository.leerOcurrencias.mockResolvedValue([
        ocurrencia({ turnoId: 1, fecha: HOY, alumnoId: 12 }),
        ocurrencia({ turnoId: 2, fecha: HOY, alumnoId: 13 }),
        ocurrencia({ turnoId: 3, fecha: HOY, alumnoId: 14, estado: 'CANCELADO' }),
        ocurrencia({ turnoId: 4, fecha: HOY, alumnoId: 15, estado: 'SIN_REGISTRAR' }),
      ])
      repos.repository.leerPrioridades.mockResolvedValue(
        prioridades(
          [12, 3, HOY, { prioridad: 'ALTA', examen }],
          [13, 3, HOY, { prioridad: 'BAJA' }],
          [15, 3, HOY, { prioridad: 'ALTA', examen }],
        ),
      )
    })

    it('`prioridad` ALTA sólo trae esas ocurrencias (y no las canceladas)', async () => {
      const pagina = await service.listarAgenda({ page: 1, pageSize: 20, prioridad: 'ALTA' })

      expect(pagina.data.map((item) => item.turnoId)).toEqual([1, 4])
      expect(pagina.data.every((item) => item.prioridad === 'ALTA')).toBe(true)
      expect(pagina.meta.total).toBe(2)
    })

    it('`prioridad` BAJA no trae las canceladas aunque no tengan prioridad', async () => {
      const pagina = await service.listarAgenda({ page: 1, pageSize: 20, prioridad: 'BAJA' })

      expect(pagina.data.map((item) => item.turnoId)).toEqual([2])
    })

    it('`estado` CANCELADO trae sólo las canceladas, sin pedir prioridades', async () => {
      const pagina = await service.listarAgenda({ page: 1, pageSize: 20, estado: 'CANCELADO' })

      expect(pagina.data.map((item) => item.turnoId)).toEqual([3])
      expect(repos.repository.leerPrioridades).toHaveBeenCalledWith([])
    })

    it('`estado` SIN_REGISTRAR y `estado` AGENDADO filtran por el de la ocurrencia', async () => {
      const sinRegistrar = await service.listarAgenda({
        page: 1,
        pageSize: 20,
        estado: 'SIN_REGISTRAR',
      })
      const agendadas = await service.listarAgenda({ page: 1, pageSize: 20, estado: 'AGENDADO' })

      expect(sinRegistrar.data.map((item) => item.turnoId)).toEqual([4])
      expect(agendadas.data.map((item) => item.turnoId)).toEqual([1, 2])
    })

    it('`estado` y `prioridad` se combinan (los dos tienen que cumplirse)', async () => {
      const pagina = await service.listarAgenda({
        page: 1,
        pageSize: 20,
        estado: 'AGENDADO',
        prioridad: 'ALTA',
      })
      const ninguna = await service.listarAgenda({
        page: 1,
        pageSize: 20,
        estado: 'CANCELADO',
        prioridad: 'ALTA',
      })

      expect(pagina.data.map((item) => item.turnoId)).toEqual([1])
      expect(ninguna.data).toEqual([])
    })

    it('se combinan con `q` y con la paginación: el total es el de lo filtrado', async () => {
      const pagina = await service.listarAgenda({
        page: 2,
        pageSize: 1,
        prioridad: 'ALTA',
        q: 'gonzalez',
      })

      expect(pagina.data.map((item) => item.turnoId)).toEqual([4])
      expect(pagina.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 })
    })
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
        alumnoId: 13,
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

  it('arma cada ocurrencia campo por campo, con las canceladas, en el orden del motor', async () => {
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades(
        [13, 3, MARTES, { prioridad: 'ALTA', examen }],
        [12, 3, LUNES, { prioridad: 'BAJA' }],
      ),
    )

    const agenda = await service.listarAgendaPropia({ desde: MARTES, hasta: LUNES }, actorProfesor)

    expect(agenda).toEqual([
      {
        turnoId: 32,
        fecha: MARTES,
        bloqueAgendaId: 10,
        diaSemana: 2,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 13, apellido: 'González', nombre: 'Lucía' },
        materia: { id: 3, nombre: 'Matemática' },
        aula: { id: 3, nombre: 'Aula 3' },
        tipo: 'SESION_UNICA',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: 'ALTA',
        examen,
        cupo: { ocupados: 1, capacidad: 4 },
      },
      expect.objectContaining({
        turnoId: 31,
        fecha: LUNES,
        tipo: 'RECURRENTE',
        prioridad: 'BAJA',
        examen: null,
      }),
      expect.objectContaining({ turnoId: 33, estado: 'CANCELADO', prioridad: null, examen: null }),
    ])
    expect(JSON.stringify(agenda)).not.toContain('busqueda')
  })

  it('una ocurrencia ya pagada sale con estadoPago PAGADO', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({
        turnoId: 31,
        fecha: LUNES,
        pago: { estado: 'PAGADO', pagoId: 2, importeAplicado: 4000 },
      }),
    ])

    const agenda = await service.listarAgendaPropia({ desde: LUNES }, actorProfesor)

    expect(agenda).toEqual([expect.objectContaining({ turnoId: 31, estadoPago: 'PAGADO' })])
  })

  it('filtra por estado y por prioridad, sin cambiar lo que se le pide al motor', async () => {
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades(
        [13, 3, MARTES, { prioridad: 'ALTA', examen }],
        [12, 3, LUNES, { prioridad: 'BAJA' }],
      ),
    )

    const canceladas = await service.listarAgendaPropia(
      { desde: MARTES, hasta: LUNES, estado: 'CANCELADO' },
      actorProfesor,
    )
    const altas = await service.listarAgendaPropia(
      { desde: MARTES, hasta: LUNES, prioridad: 'ALTA' },
      actorProfesor,
    )

    expect(canceladas.map((item) => item.turnoId)).toEqual([33])
    expect(altas.map((item) => item.turnoId)).toEqual([32])
    expect(repos.repository.leerOcurrencias).toHaveBeenLastCalledWith(
      { desde: MARTES, hasta: LUNES, profesorId: 4 },
      relojFijo,
    )
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
        bloqueAgendaId: 10,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
        materia: { id: 3, nombre: 'Matemática' },
        aula: { id: 3, nombre: 'Aula 3' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: null,
        examen: null,
        cupo: { ocupados: 1, capacidad: 4 },
      },
      expect.objectContaining({ turnoId: 90, fecha: '2026-10-05' }),
    ])
  })

  it('filtra por estado y por prioridad, y también trae las canceladas', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 90, fecha: LUNES, profesorId: 7, profesor: ruiz }),
      ocurrencia({
        turnoId: 90,
        fecha: '2026-10-05',
        profesorId: 7,
        profesor: ruiz,
        estado: 'CANCELADO',
      }),
    ])
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades([12, 3, LUNES, { prioridad: 'ALTA', examen }]),
    )

    const todas = await service.listarAgendaDeProfesor({ profesorId: 7, desde: LUNES })
    const altas = await service.listarAgendaDeProfesor({
      profesorId: 7,
      desde: LUNES,
      prioridad: 'ALTA',
    })
    const canceladas = await service.listarAgendaDeProfesor({
      profesorId: 7,
      desde: LUNES,
      estado: 'CANCELADO',
    })

    expect(todas.map((item) => [item.fecha, item.estado, item.prioridad])).toEqual([
      [LUNES, 'AGENDADO', 'ALTA'],
      ['2026-10-05', 'CANCELADO', null],
    ])
    expect(altas.map((item) => item.fecha)).toEqual([LUNES])
    expect(canceladas.map((item) => item.fecha)).toEqual(['2026-10-05'])
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
// Agenda del centro (T-57)
// ---------------------------------------------------------------------------------------------

describe('listarAgendaDelCentro', () => {
  const LUNES = '2026-09-28'
  const DOMINGO = '2026-10-04'

  /** Una semana: dos profesores en el mismo bloque horario, una cancelada y una de otro día. */
  beforeEach(() => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 20, fecha: LUNES, profesorId: 7, profesor: ruiz, alumnoId: 13 }),
      ocurrencia({ turnoId: 21, fecha: LUNES, estado: 'CANCELADO', alumnoId: 14 }),
      ocurrencia({ turnoId: 22, fecha: LUNES, alumnoId: 12 }),
      ocurrencia({ turnoId: 23, fecha: LUNES, horaInicio: 480, horaFin: 540, alumnoId: 12 }),
      ocurrencia({ turnoId: 24, fecha: '2026-09-29', diaSemana: 2, alumnoId: 12 }),
    ])
    repos.repository.leerPrioridades.mockResolvedValue(
      prioridades(
        [12, 3, LUNES, { prioridad: 'ALTA', examen }],
        [13, 3, LUNES, { prioridad: 'BAJA' }],
        [12, 3, '2026-09-29', { prioridad: 'MEDIA' }],
      ),
    )
  })

  it('pide al motor el rango de una semana de todos los profesores, sin profesorId', async () => {
    await service.listarAgendaDelCentro({ desde: LUNES, hasta: DOMINGO })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      {
        desde: LUNES,
        hasta: DOMINGO,
        profesorId: undefined,
        materiaId: undefined,
        aulaId: undefined,
      },
      relojFijo,
    )
  })

  it('devuelve un arreglo sin paginar, con el profesor, las canceladas y la prioridad', async () => {
    const agenda = await service.listarAgendaDelCentro({ desde: LUNES, hasta: DOMINGO })

    expect(agenda.map((item) => [item.fecha, item.horaInicio, item.turnoId])).toEqual([
      [LUNES, '08:00', 23],
      [LUNES, '09:00', 21], // Pérez, antes que Ruiz (busqueda); entre los dos de Pérez, por id
      [LUNES, '09:00', 22],
      [LUNES, '09:00', 20],
      ['2026-09-29', '09:00', 24],
    ])
    expect(agenda[2]).toEqual(
      expect.objectContaining({
        profesor: { id: 4, apellido: 'Pérez', nombre: 'Ana' },
        bloqueAgendaId: 10,
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
        prioridad: 'ALTA',
        examen,
      }),
    )
    expect(agenda[1]).toEqual(
      expect.objectContaining({ turnoId: 21, estado: 'CANCELADO', prioridad: null, examen: null }),
    )
    expect(agenda[3]?.profesor).toEqual({ id: 7, apellido: 'Ruiz', nombre: 'Juan' })
    expect(JSON.stringify(agenda)).not.toContain('busqueda')
  })

  it('pasa profesor, materia y aula al motor', async () => {
    await service.listarAgendaDelCentro({
      desde: LUNES,
      hasta: DOMINGO,
      profesorId: 7,
      materiaId: 3,
      aulaId: 1,
    })

    expect(repos.repository.leerOcurrencias).toHaveBeenCalledWith(
      { desde: LUNES, hasta: DOMINGO, profesorId: 7, materiaId: 3, aulaId: 1 },
      relojFijo,
    )
  })

  it('filtra por estado y por prioridad', async () => {
    const altas = await service.listarAgendaDelCentro({
      desde: LUNES,
      hasta: DOMINGO,
      prioridad: 'ALTA',
    })
    const canceladas = await service.listarAgendaDelCentro({
      desde: LUNES,
      hasta: DOMINGO,
      estado: 'CANCELADO',
    })

    expect(altas.map((item) => item.turnoId)).toEqual([23, 22])
    expect(canceladas.map((item) => item.turnoId)).toEqual([21])
  })

  it('un rango de 31 días (el máximo) se acepta', async () => {
    await expect(
      service.listarAgendaDelCentro({ desde: LUNES, hasta: '2026-10-28' }),
    ).resolves.toBeDefined()
  })

  it('un rango de más de 31 días → 400 sobre `hasta`, sin leer nada', async () => {
    const error = await errorDe(
      service.listarAgendaDelCentro({ desde: LUNES, hasta: '2026-10-29' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }])
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
  })

  it('`hasta` anterior a `desde` → 400 sobre `hasta`', async () => {
    const error = await errorDe(service.listarAgendaDelCentro({ desde: DOMINGO, hasta: LUNES }))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.repository.leerOcurrencias).not.toHaveBeenCalled()
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

// ---------------------------------------------------------------------------------------------
// Cupo de la clase (HU-19)
// ---------------------------------------------------------------------------------------------

describe('cupo de la clase', () => {
  const DESDE = '2026-09-28'
  const HASTA = '2026-10-04'

  it('cada ocurrencia lleva el cupo de su clase, el mismo para todas las de la clase', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: DESDE, bloqueAgendaId: 10 }),
      ocurrencia({ turnoId: 2, fecha: DESDE, bloqueAgendaId: 10 }),
      ocurrencia({ turnoId: 3, fecha: DESDE, bloqueAgendaId: 11 }),
    ])
    repos.repository.leerCupos.mockResolvedValue(
      new Map([
        [claveOcupacion(10, DESDE), { ocupados: 3, capacidad: 4 }],
        [claveOcupacion(11, DESDE), { ocupados: 6, capacidad: 6 }],
      ]),
    )

    const agenda = await service.listarAgendaDelCentro({ desde: DESDE, hasta: HASTA })

    expect(agenda.map((item) => item.cupo)).toEqual([
      { ocupados: 3, capacidad: 4 },
      { ocupados: 3, capacidad: 4 },
      { ocupados: 6, capacidad: 6 },
    ])
  })

  it('pide una sola vez cada clase distinta, no una por ocurrencia', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: DESDE, bloqueAgendaId: 10 }),
      ocurrencia({ turnoId: 2, fecha: DESDE, bloqueAgendaId: 10 }),
      ocurrencia({ turnoId: 1, fecha: '2026-10-05', bloqueAgendaId: 10 }),
    ])

    await service.listarAgendaDelCentro({ desde: DESDE, hasta: '2026-10-05' })

    expect(repos.repository.leerCupos).toHaveBeenCalledTimes(1)
    expect(repos.repository.leerCupos).toHaveBeenCalledWith([
      { bloqueAgendaId: 10, fecha: DESDE },
      { bloqueAgendaId: 10, fecha: '2026-10-05' },
    ])
  })

  it('el cupo no depende de los filtros: cuenta los turnos que el filtro deja afuera', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: DESDE, estado: 'CANCELADO' }),
      ocurrencia({ turnoId: 2, fecha: DESDE }),
    ])
    repos.repository.leerCupos.mockResolvedValue(
      new Map([[claveOcupacion(10, DESDE), { ocupados: 3, capacidad: 4 }]]),
    )

    const agenda = await service.listarAgendaDelCentro({
      desde: DESDE,
      hasta: HASTA,
      estado: 'CANCELADO',
    })

    expect(agenda).toHaveLength(1)
    expect(agenda[0]?.cupo).toEqual({ ocupados: 3, capacidad: 4 })
  })

  it('la agenda diaria pide el cupo solo de las ocurrencias de la página', async () => {
    repos.repository.leerOcurrencias.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: DESDE, bloqueAgendaId: 10 }),
      ocurrencia({ turnoId: 2, fecha: DESDE, bloqueAgendaId: 11 }),
    ])

    await service.listarAgenda({ fecha: DESDE, page: 1, pageSize: 1 })

    expect(repos.repository.leerCupos).toHaveBeenCalledWith([{ bloqueAgendaId: 10, fecha: DESDE }])
  })

  it('también lo llevan las agendas de un profesor', async () => {
    repos.profesoresRepository.buscarConAsignaciones.mockResolvedValue({} as never)
    repos.repository.leerOcurrencias.mockResolvedValue([ocurrencia({ turnoId: 1, fecha: DESDE })])

    const agenda = await service.listarAgendaDeProfesor({
      profesorId: 4,
      desde: DESDE,
      hasta: HASTA,
    })

    expect(agenda[0]?.cupo).toEqual({ ocupados: 1, capacidad: 4 })
  })
})
