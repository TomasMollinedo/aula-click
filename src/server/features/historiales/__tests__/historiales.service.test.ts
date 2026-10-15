import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import { OBSERVACION_CIERRE_SISTEMA } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { MENSAJE_RANGO_INVERTIDO, MENSAJE_RANGO_MAXIMO } from '../historiales.reglas'
import type { HistorialesRepository, Ocurrencia } from '../historiales.repository'
import { crearHistorialesService } from '../historiales.service'

// El service de `historiales` (T-108): arma el historial de un alumno (HU-31) y "Mis materias" del
// portal (HU-33). El repository se reemplaza por uno falso: el motor de ocurrencias (T-74) y
// `ultimasIndicaciones` (T-81) ya están probados en sus propias features. Reloj fijo: el estado y
// el plazo de cada ocurrencia los decide el motor, así que acá se fijan en la ocurrencia falsa.

const HOY = '2026-10-15'
const relojFijo = () => new Date('2026-10-15T15:00:00Z')

/** Una ocurrencia como la arma el motor (horas en minutos, `busqueda` interno). */
function ocurrencia(
  datos: Partial<Ocurrencia> & Pick<Ocurrencia, 'turnoId' | 'fecha'>,
): Ocurrencia {
  return {
    bloqueAgendaId: 10,
    diaSemana: 2,
    horaInicio: 480,
    horaFin: 540,
    profesorId: 4,
    aulaId: 3,
    alumnoId: 12,
    materiaId: 3,
    tipo: 'RECURRENTE',
    estado: 'REALIZADO',
    pago: { estado: 'PENDIENTE' },
    asistencia: null,
    plazoAsistencia: { vence: '2026-10-20', vencido: false },
    serie: { serieId: null, fechaInicio: datos.fecha, fechaFin: null, finEfectivo: null },
    alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    ...datos,
  }
}

/** Una asistencia presente con sus textos. */
function presente(trabajado: string | null, indicaciones: string | null) {
  return {
    estado: 'PRESENTE' as const,
    trabajado,
    indicaciones,
    observacion: null,
    createdById: 'usr_ana',
    createdAt: '2026-10-13T12:00:00.000Z',
    updatedById: 'usr_ana',
    updatedAt: '2026-10-13T12:00:00.000Z',
  }
}

/** El alumno 12, como lo devuelve `alumnosRepository.buscarPorId`. */
const ALUMNO = { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' } as NonNullable<
  Awaited<ReturnType<AlumnosRepository['buscarPorId']>>
>

const actorMesa: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const actorProfesor: Actor = { userId: 'usr_ana', role: 'PROFESOR' }
const actorAlumno: Actor = { userId: 'usr_lucia', role: 'ALUMNO', alumnoId: 12 }

function crearRepositories() {
  return {
    repository: {
      leerOcurrenciasDelAlumno: vi.fn<HistorialesRepository['leerOcurrenciasDelAlumno']>(),
      buscarFechaDelPrimerTurno: vi.fn<HistorialesRepository['buscarFechaDelPrimerTurno']>(),
      profesorTieneAlumno: vi.fn<HistorialesRepository['profesorTieneAlumno']>(),
      buscarUltimasIndicaciones: vi.fn<HistorialesRepository['buscarUltimasIndicaciones']>(),
    },
    profesoresRepository: {
      buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>(),
    },
    alumnosRepository: { buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>() },
  }
}

let repos: ReturnType<typeof crearRepositories>
let service: ReturnType<typeof crearHistorialesService>

beforeEach(() => {
  repos = crearRepositories()
  service = crearHistorialesService({ ...repos, reloj: relojFijo })
  repos.alumnosRepository.buscarPorId.mockResolvedValue(ALUMNO)
  repos.repository.buscarFechaDelPrimerTurno.mockResolvedValue('2026-03-03')
  repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
  repos.repository.buscarUltimasIndicaciones.mockResolvedValue(null)
  repos.profesoresRepository.buscarIdPorUsuario.mockResolvedValue(4)
  repos.repository.profesorTieneAlumno.mockResolvedValue(true)
})

/** Lo que devuelve el motor en todas las lecturas de la prueba. */
function conOcurrencias(...ocurrencias: Ocurrencia[]) {
  repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue(ocurrencias)
}

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
// obtenerDelAlumno
// ---------------------------------------------------------------------------------------------

describe('obtenerDelAlumno', () => {
  it('sin `desde` ni `hasta`, el mes en curso, y las clases hasta hoy', async () => {
    const historial = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(historial.desde).toBe('2026-10-01')
    expect(historial.hasta).toBe('2026-10-31')
    // El rango de la lectura se recorta a hoy: los turnos futuros no son historial.
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      {
        alumnoId: 12,
        desde: '2026-10-01',
        hasta: HOY,
        materiaId: undefined,
        profesorId: undefined,
      },
      relojFijo,
    )
  })

  it('un `hasta` anterior a hoy se respeta tal cual', async () => {
    await service.obtenerDelAlumno(12, { desde: '2026-09-01', hasta: '2026-09-30' }, actorMesa)

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      expect.objectContaining({ desde: '2026-09-01', hasta: '2026-09-30' }),
      relojFijo,
    )
  })

  it('los filtros de materia y profesor viajan al motor', async () => {
    await service.obtenerDelAlumno(12, { materiaId: 3, profesorId: 4 }, actorMesa)

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      expect.objectContaining({ materiaId: 3, profesorId: 4 }),
      relojFijo,
    )
  })

  it('un alumno que cursa una materia con dos profesores ve dos grupos, cada uno con su porcentaje', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
      ocurrencia({ turnoId: 1, fecha: '2026-10-13', estado: 'AUSENTE' }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-07',
        estado: 'REALIZADO',
        profesorId: 9,
        profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz', busqueda: 'ruiz diego' },
      }),
    )

    const { grupos } = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      resumen: { realizadas: 1, ausencias: 1, porcentaje: 50 },
    })
    expect(grupos[1]).toMatchObject({
      profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz' },
      resumen: { realizadas: 1, ausencias: 0, porcentaje: 100 },
    })
  })

  it('el porcentaje no cuenta los cancelados, los sin registrar ni los agendados', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
      ocurrencia({ turnoId: 2, fecha: '2026-10-07', estado: 'CANCELADO', plazoAsistencia: null }),
      ocurrencia({ turnoId: 3, fecha: '2026-10-08', estado: 'SIN_REGISTRAR' }),
      ocurrencia({ turnoId: 4, fecha: HOY, estado: 'AGENDADO', plazoAsistencia: null }),
    )

    const { grupos } = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(grupos[0].resumen).toEqual({ realizadas: 1, ausencias: 0, porcentaje: 100 })
    // Las cuatro se muestran igual: lo que no cuenta es el porcentaje.
    expect(grupos[0].bloques).toHaveLength(4)
  })

  it('tres horas seguidas son un bloque con tres clases, los textos una vez, y cuentan tres', async () => {
    const textos = presente('Ecuaciones', 'Practicar la guía')
    conOcurrencias(
      ocurrencia({
        turnoId: 1,
        fecha: '2026-10-13',
        horaInicio: 480,
        horaFin: 540,
        asistencia: textos,
      }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        asistencia: textos,
      }),
      ocurrencia({
        turnoId: 3,
        fecha: '2026-10-13',
        horaInicio: 600,
        horaFin: 660,
        asistencia: textos,
      }),
    )

    const { grupos } = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(grupos[0].bloques).toHaveLength(1)
    expect(grupos[0].bloques[0]).toMatchObject({
      horaInicio: '08:00',
      horaFin: '11:00',
      horas: 3,
      textos: { trabajado: 'Ecuaciones', indicaciones: 'Practicar la guía' },
    })
    expect(grupos[0].bloques[0].clases).toHaveLength(3)
    expect(grupos[0].resumen).toEqual({ realizadas: 3, ausencias: 0, porcentaje: 100 })
  })

  it('una hora del bloque con otros textos trae sus `textosPropios`', async () => {
    conOcurrencias(
      ocurrencia({
        turnoId: 1,
        fecha: '2026-10-13',
        horaInicio: 480,
        horaFin: 540,
        asistencia: presente('Ecuaciones', null),
      }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        asistencia: presente('Ecuaciones y verificación', null),
      }),
    )

    const { clases } = (await service.obtenerDelAlumno(12, {}, actorMesa)).grupos[0].bloques[0]

    expect(clases[0].textosPropios).toBeNull()
    expect(clases[1].textosPropios).toEqual({
      trabajado: 'Ecuaciones y verificación',
      indicaciones: null,
    })
  })

  it('una hora cancelada en el medio corta el bloque y muestra su motivo', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-10-13', horaInicio: 480, horaFin: 540 }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-13',
        horaInicio: 540,
        horaFin: 600,
        estado: 'CANCELADO',
        plazoAsistencia: null,
        cancelacion: {
          motivo: 'CANCELACION_ALUMNO',
          detalle: 'Viaje familiar',
          createdById: 'usr_mesa',
          createdAt: '2026-10-10T12:00:00.000Z',
        },
      }),
      ocurrencia({ turnoId: 3, fecha: '2026-10-13', horaInicio: 600, horaFin: 660 }),
    )

    const { bloques } = (await service.obtenerDelAlumno(12, {}, actorMesa)).grupos[0]

    expect(bloques.map((bloque) => [bloque.horaInicio, bloque.horas])).toEqual([
      ['10:00', 1],
      ['09:00', 1],
      ['08:00', 1],
    ])
    expect(bloques[1].clases[0].cancelacion).toEqual({
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Viaje familiar',
    })
  })

  it('un "Sin registrar" vencido viene cerrado por el sistema, con su observación', async () => {
    conOcurrencias(
      ocurrencia({
        turnoId: 1,
        fecha: '2026-10-01',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-10-08', vencido: true },
      }),
    )

    const clase = (await service.obtenerDelAlumno(12, {}, actorMesa)).grupos[0].bloques[0].clases[0]

    expect(clase).toMatchObject({
      estado: 'SIN_REGISTRAR',
      cerradaPorSistema: true,
      observacion: OBSERVACION_CIERRE_SISTEMA,
      plazoAsistencia: { vence: '2026-10-08', vencido: true },
    })
  })

  it('las `opciones` salen del historial completo, no del período filtrado', async () => {
    // El período (primera llamada) trae sólo Matemática; el historial completo (segunda), las dos.
    repos.repository.leerOcurrenciasDelAlumno
      .mockResolvedValueOnce([ocurrencia({ turnoId: 1, fecha: '2026-10-06' })])
      .mockResolvedValueOnce([
        ocurrencia({ turnoId: 1, fecha: '2026-10-06' }),
        ocurrencia({
          turnoId: 2,
          fecha: '2026-05-04',
          materiaId: 5,
          materia: { id: 5, nombre: 'Lengua' },
          profesorId: 9,
          profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz', busqueda: 'ruiz diego' },
        }),
      ])

    const historial = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(historial.grupos).toHaveLength(1)
    expect(historial.opciones).toEqual({
      materias: [
        { id: 5, nombre: 'Lengua' },
        { id: 3, nombre: 'Matemática' },
      ],
      profesores: [
        { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        { id: 9, nombre: 'Diego', apellido: 'Ruiz' },
      ],
    })
    // El historial completo se lee desde el primer turno del alumno hasta hoy.
    expect(repos.repository.buscarFechaDelPrimerTurno).toHaveBeenCalledExactlyOnceWith(12)
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenLastCalledWith(
      { alumnoId: 12, desde: '2026-03-03', hasta: HOY },
      relojFijo,
    )
  })

  it('un alumno sin ningún turno no lee el motor para las opciones', async () => {
    repos.repository.buscarFechaDelPrimerTurno.mockResolvedValue(null)

    const historial = await service.obtenerDelAlumno(12, {}, actorMesa)

    expect(historial.grupos).toEqual([])
    expect(historial.opciones).toEqual({ materias: [], profesores: [] })
    // Sólo la lectura del período; la del historial completo no se hace.
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledTimes(1)
  })

  it('el profesor ve el historial completo de su alumno, también las clases de otros profesores', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-10-06' }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-07',
        profesorId: 9,
        profesor: { id: 9, nombre: 'Diego', apellido: 'Ruiz', busqueda: 'ruiz diego' },
      }),
    )

    const { grupos } = await service.obtenerDelAlumno(12, {}, actorProfesor)

    expect(grupos.map((grupo) => grupo.profesor.id)).toEqual([4, 9])
    expect(repos.repository.profesorTieneAlumno).toHaveBeenCalledExactlyOnceWith(4, 12)
  })

  it('un profesor sin turnos con el alumno → 403', async () => {
    repos.repository.profesorTieneAlumno.mockResolvedValue(false)

    const error = await errorDe(service.obtenerDelAlumno(12, {}, actorProfesor))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error.message).toBe('El alumno no tiene turnos con usted')
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('un usuario con rol profesor que no es profesor → 403', async () => {
    repos.profesoresRepository.buscarIdPorUsuario.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDelAlumno(12, {}, actorProfesor))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.profesorTieneAlumno).not.toHaveBeenCalled()
  })

  it('un alumno inexistente → 404, y se chequea antes que el permiso del profesor', async () => {
    repos.alumnosRepository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDelAlumno(99, {}, actorProfesor))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Alumno no encontrado')
    expect(repos.repository.profesorTieneAlumno).not.toHaveBeenCalled()
  })

  it('`hasta` anterior a `desde` → 400 en `hasta`, sin tocar la base', async () => {
    const error = await errorDe(
      service.obtenerDelAlumno(12, { desde: '2026-10-15', hasta: '2026-10-14' }, actorMesa),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.alumnosRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('un período de más de 366 días → 400 en `hasta`', async () => {
    const error = await errorDe(
      service.obtenerDelAlumno(12, { desde: '2026-01-01', hasta: '2027-01-02' }, actorMesa),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }])
  })
})

// ---------------------------------------------------------------------------------------------
// misMaterias (portal)
// ---------------------------------------------------------------------------------------------

describe('misMaterias', () => {
  it('cada materia y profesor con su porcentaje y su próximo turno', async () => {
    repos.repository.leerOcurrenciasDelAlumno
      // Historial completo.
      .mockResolvedValueOnce([
        ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
        ocurrencia({ turnoId: 1, fecha: '2026-10-13', estado: 'AUSENTE' }),
      ])
      // De hoy en adelante.
      .mockResolvedValueOnce([
        ocurrencia({ turnoId: 1, fecha: '2026-10-20', estado: 'AGENDADO', plazoAsistencia: null }),
      ])

    expect(await service.misMaterias(actorAlumno)).toEqual([
      {
        materia: { id: 3, nombre: 'Matemática' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        proximoTurno: { fecha: '2026-10-20', horaInicio: '08:00', horaFin: '09:00' },
        porcentaje: 50,
      },
    ])
    // El próximo turno se busca hasta 366 días adelante, desde hoy.
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenLastCalledWith(
      { alumnoId: 12, desde: HOY, hasta: '2027-10-16' },
      relojFijo,
    )
  })

  it('el alumno sale de la sesión: un actor sin alumno → 403', async () => {
    const error = await errorDe(service.misMaterias({ userId: 'usr_x', role: 'ALUMNO' }))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('sin turnos, un arreglo vacío', async () => {
    repos.repository.buscarFechaDelPrimerTurno.mockResolvedValue(null)

    expect(await service.misMaterias(actorAlumno)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// miMateria (portal)
// ---------------------------------------------------------------------------------------------

describe('miMateria', () => {
  it('por defecto el mes en curso, con el resumen y los bloques del mes', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-09-29', estado: 'REALIZADO' }),
      ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
      ocurrencia({ turnoId: 1, fecha: '2026-10-13', estado: 'AUSENTE' }),
      ocurrencia({ turnoId: 1, fecha: '2026-10-20', estado: 'AGENDADO', plazoAsistencia: null }),
    )

    const mia = await service.miMateria(3, 4, {}, actorAlumno)

    expect(mia.mes).toBe('2026-10')
    expect(mia.materia).toEqual({ id: 3, nombre: 'Matemática' })
    expect(mia.profesor).toEqual({ id: 4, nombre: 'Ana', apellido: 'Pérez' })
    // Sólo las dos del mes y hasta hoy: la de septiembre y la del 20 quedan afuera.
    expect(mia.resumen).toEqual({ realizadas: 1, ausencias: 1, porcentaje: 50 })
    expect(mia.bloques.map((bloque) => bloque.fecha)).toEqual(['2026-10-13', '2026-10-06'])
  })

  it('un mes pedido se respeta', async () => {
    conOcurrencias(ocurrencia({ turnoId: 1, fecha: '2026-09-29', estado: 'REALIZADO' }))

    const mia = await service.miMateria(3, 4, { mes: '2026-09' }, actorAlumno)

    expect(mia.mes).toBe('2026-09')
    expect(mia.bloques.map((bloque) => bloque.fecha)).toEqual(['2026-09-29'])
  })

  it('no muestra las clases "Sin registrar" ni las agendadas', async () => {
    conOcurrencias(
      ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-07',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-10-14', vencido: true },
      }),
      ocurrencia({ turnoId: 3, fecha: HOY, estado: 'AGENDADO', plazoAsistencia: null }),
    )

    const mia = await service.miMateria(3, 4, {}, actorAlumno)

    expect(mia.bloques).toHaveLength(1)
    expect(mia.bloques[0].clases.map((clase) => clase.estado)).toEqual(['REALIZADO'])
    expect(JSON.stringify(mia)).not.toContain(OBSERVACION_CIERRE_SISTEMA)
    expect(JSON.stringify(mia)).not.toContain('SIN_REGISTRAR')
  })

  it('no publica la observación interna ni el motivo de la cancelación', async () => {
    conOcurrencias(
      ocurrencia({
        turnoId: 1,
        fecha: '2026-10-06',
        estado: 'AUSENTE',
        asistencia: {
          estado: 'AUSENTE',
          trabajado: null,
          indicaciones: null,
          observacion: 'Observación interna',
          createdById: 'usr_ana',
          createdAt: '2026-10-06T12:00:00.000Z',
          updatedById: 'usr_ana',
          updatedAt: '2026-10-06T12:00:00.000Z',
        },
      }),
      ocurrencia({
        turnoId: 2,
        fecha: '2026-10-07',
        estado: 'CANCELADO',
        plazoAsistencia: null,
        cancelacion: {
          motivo: 'CANCELACION_PROFESOR',
          detalle: 'Paro de transporte',
          createdById: 'usr_mesa',
          createdAt: '2026-10-06T12:00:00.000Z',
        },
      }),
    )

    const mia = await service.miMateria(3, 4, {}, actorAlumno)

    expect(mia.bloques.flatMap((bloque) => bloque.clases).map((clase) => clase.estado)).toEqual([
      'CANCELADO',
      'AUSENTE',
    ])
    expect(JSON.stringify(mia)).not.toContain('Observación interna')
    expect(JSON.stringify(mia)).not.toContain('Paro de transporte')
    expect(JSON.stringify(mia)).not.toContain('CANCELACION_PROFESOR')
  })

  it('las indicaciones pueden ser de una clase anterior al mes que se muestra', async () => {
    conOcurrencias(ocurrencia({ turnoId: 1, fecha: '2026-10-06', estado: 'REALIZADO' }))
    repos.repository.buscarUltimasIndicaciones.mockResolvedValue({
      fecha: '2026-09-29',
      indicaciones: 'Repasar la guía 3',
    })

    const mia = await service.miMateria(3, 4, { mes: '2026-10' }, actorAlumno)

    expect(mia.indicacionesProximaClase).toEqual({
      fecha: '2026-09-29',
      indicaciones: 'Repasar la guía 3',
    })
    // `antesDe` es hoy + 1: la clase de hoy también cuenta.
    expect(repos.repository.buscarUltimasIndicaciones).toHaveBeenCalledExactlyOnceWith({
      alumnoId: 12,
      materiaId: 3,
      antesDe: '2026-10-16',
    })
  })

  it('sin indicaciones previas, `indicacionesProximaClase` es null', async () => {
    conOcurrencias(ocurrencia({ turnoId: 1, fecha: '2026-10-06' }))

    expect((await service.miMateria(3, 4, {}, actorAlumno)).indicacionesProximaClase).toBeNull()
  })

  it('una materia y profesor en los que no cursa → 404', async () => {
    conOcurrencias()

    const error = await errorDe(service.miMateria(7, 9, {}, actorAlumno))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('No cursás esa materia con ese profesor')
    expect(repos.repository.buscarUltimasIndicaciones).not.toHaveBeenCalled()
  })

  it('un alumno sin ningún turno → 404', async () => {
    repos.repository.buscarFechaDelPrimerTurno.mockResolvedValue(null)

    const error = await errorDe(service.miMateria(3, 4, {}, actorAlumno))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('una sola lectura del motor, filtrada por la materia y el profesor', async () => {
    conOcurrencias(ocurrencia({ turnoId: 1, fecha: '2026-10-06' }))

    await service.miMateria(3, 4, {}, actorAlumno)

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledExactlyOnceWith(
      { alumnoId: 12, desde: '2026-03-03', hasta: '2027-10-16', materiaId: 3, profesorId: 4 },
      relojFijo,
    )
  })

  it('el alumno sale de la sesión: un actor sin alumno → 403', async () => {
    const error = await errorDe(service.miMateria(3, 4, {}, { userId: 'usr_x', role: 'ALUMNO' }))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })
})
