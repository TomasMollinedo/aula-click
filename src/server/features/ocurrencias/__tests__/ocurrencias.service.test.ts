import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type {
  FilaDeSerie,
  Finalizacion,
  Ocurrencia,
  OcurrenciasRepository,
  PagoDeOcurrencia,
} from '../ocurrencias.repository'
import { OBSERVACION_CIERRE_SISTEMA } from '@/server/features/turnos/ocurrencias.condiciones'
import {
  MENSAJE_FUERA_DE_VENTANA,
  MENSAJE_RANGO_INVERTIDO,
  MENSAJE_RANGO_MIS_TURNOS,
} from '../ocurrencias.reglas'
import { crearOcurrenciasService } from '../ocurrencias.service'

// El service de `ocurrencias` (T-43): arma el detalle de una ocurrencia (con su pago) y los turnos
// de un alumno. El repository se reemplaza por uno falso: el motor de T-30, `leerPrioridades` de
// T-31 y `leerPagoDeOcurrencia` de `pagos` ya están probados en sus propias features.

const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

/** Una ocurrencia como la arma el motor (horas en minutos, `busqueda` interno). */
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
    asistencia: null,
    plazoAsistencia: null,
    serie: { serieId: null, fechaInicio: datos.fecha, fechaFin: null, finEfectivo: null },
    alumno: { id: 12, nombre: 'Lucía', apellido: 'González', busqueda: 'gonzalez lucia 40123456' },
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez', busqueda: 'perez ana 30111222' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    ...datos,
  }
}

/** Una fila de la hora del turno 31 (un tramo), como la lee `leerFilasDeLaSerie` del motor. */
function filaDeLaHora(datos: Partial<FilaDeSerie> = {}): FilaDeSerie {
  return {
    turnoId: 31,
    serieId: null,
    bloqueAgendaId: 10,
    alumnoId: 12,
    tipo: 'RECURRENTE',
    activo: true,
    fechaInicio: '2026-03-02',
    fechaFin: null,
    diaSemana: 1,
    horaInicio: 540,
    horaFin: 600,
    finalizadaDesde: null,
    ...datos,
  }
}

const DATOS_ADICIONALES = {
  alumnoId: 12,
  alumnoDni: '40123456',
  observaciones: null,
  temas: null,
  precioVigente: 8000,
  createdAt: '2026-08-01T13:00:00.000Z',
  updatedAt: '2026-08-01T13:00:00.000Z',
  createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez', rol: 'MESA_ENTRADAS' as const },
  updatedBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
}

/** Lo que `pagos` devuelve del pago 31 (el importe no está acá: es el aplicado, del motor). */
const PAGO: PagoDeOcurrencia = {
  numeroComprobante: 1024,
  fechaPago: '2026-09-20',
  formaPago: { id: 1, nombre: 'Efectivo' },
  registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
  registradoEl: '2026-09-20T14:30:00.000Z',
}

const actorMesa: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const actorProfesorDueño: Actor = { userId: 'usr_ana', role: 'PROFESOR' }
const actorProfesorAjeno: Actor = { userId: 'usr_otro', role: 'PROFESOR' }
const actorAlumno: Actor = { userId: 'usr_lucia', role: 'ALUMNO', alumnoId: 12 }

function crearRepositories() {
  return {
    repository: {
      profesorTieneAlumno: vi.fn<OcurrenciasRepository['profesorTieneAlumno']>(),
      buscarDatosAdicionales: vi.fn<OcurrenciasRepository['buscarDatosAdicionales']>(),
      leerFilasDeLaHora: vi.fn<OcurrenciasRepository['leerFilasDeLaHora']>(),
      buscarFinalizacion: vi.fn<OcurrenciasRepository['buscarFinalizacion']>(),
      buscarPago: vi.fn<OcurrenciasRepository['buscarPago']>(),
      leerOcurrenciasDelAlumno: vi.fn<OcurrenciasRepository['leerOcurrenciasDelAlumno']>(),
      resolverUsuarioAuditoria: vi.fn<OcurrenciasRepository['resolverUsuarioAuditoria']>(),
      resolverUsuariosAuditoria: vi.fn<OcurrenciasRepository['resolverUsuariosAuditoria']>(),
      leerPrioridades: vi.fn<OcurrenciasRepository['leerPrioridades']>(),
    },
    profesoresRepository: {
      buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>(),
    },
    alumnosRepository: { buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>() },
  }
}

/** El alumno 12, como lo devuelve `alumnosRepository.buscarPorId` (sólo importa lo del encabezado). */
const ALUMNO = { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' } as NonNullable<
  Awaited<ReturnType<AlumnosRepository['buscarPorId']>>
>

let repos: ReturnType<typeof crearRepositories>
let service: ReturnType<typeof crearOcurrenciasService>

beforeEach(() => {
  repos = crearRepositories()
  service = crearOcurrenciasService({ ...repos, reloj: relojFijo })
  repos.repository.buscarDatosAdicionales.mockResolvedValue(DATOS_ADICIONALES)
  repos.repository.leerFilasDeLaHora.mockResolvedValue([filaDeLaHora()])
  repos.repository.buscarFinalizacion.mockResolvedValue(null)
  repos.repository.leerPrioridades.mockResolvedValue(new Map())
  repos.profesoresRepository.buscarIdPorUsuario.mockImplementation(async (usuarioId) =>
    usuarioId === 'usr_ana' ? 4 : 99,
  )
  repos.repository.profesorTieneAlumno.mockResolvedValue(false)
})

/**
 * Lo que lee el motor para el detalle: las ocurrencias del alumno en esa fecha (una sola lectura).
 * `null` = ninguna (la fecha no es una ocurrencia del turno).
 */
function delDia(...ocurrencias: (Ocurrencia | null)[]) {
  repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue(
    ocurrencias.filter((o): o is Ocurrencia => o !== null),
  )
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
// obtenerDetalle
// ---------------------------------------------------------------------------------------------

describe('obtenerDetalle', () => {
  it('el turno no existe → 404, sin leer el motor', async () => {
    repos.repository.buscarDatosAdicionales.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorMesa))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('No existe una ocurrencia con ese turno y esa fecha')
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('la fecha no es una de sus ocurrencias (sólo hay otras del alumno ese día) → el mismo 404', async () => {
    delDia(ocurrencia({ turnoId: 77, fecha: HOY }))

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorMesa))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('No existe una ocurrencia con ese turno y esa fecha')
  })

  it('una fecha posterior al fin efectivo de una serie finalizada no es una ocurrencia → 404', async () => {
    // El motor de T-30 (`leerOcurrencias`) ya no la genera: no viene entre las del alumno ese día.
    delDia(null)

    const error = await errorDe(service.obtenerDetalle(31, '2026-12-01', actorMesa))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.leerPrioridades).not.toHaveBeenCalled()
  })

  it('una sola lectura del motor: las ocurrencias del alumno del turno en esa fecha', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.buscarDatosAdicionales).toHaveBeenCalledExactlyOnceWith(31)
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledExactlyOnceWith(
      { desde: HOY, hasta: HOY, alumnoId: 12 },
      relojFijo,
    )
  })

  it('profesor ajeno al turno, sin turnos con el alumno → 403, sin pedir el resto', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorProfesorAjeno))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.profesorTieneAlumno).toHaveBeenCalledExactlyOnceWith(99, 12)
    expect(repos.repository.leerPrioridades).not.toHaveBeenCalled()
  })

  it('profesor ajeno al turno, con turnos con el alumno (HU-31) → 200 en sólo lectura', async () => {
    repos.repository.profesorTieneAlumno.mockResolvedValue(true)
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        horaInicio: 480,
        horaFin: 540,
        plazoAsistencia: { vence: '2026-09-29', vencido: false },
      }),
      ocurrencia({
        turnoId: 32,
        fecha: HOY,
        horaInicio: 540,
        horaFin: 600,
        plazoAsistencia: { vence: '2026-09-29', vencido: false },
      }),
    )

    const detalle = await service.obtenerDetalle(31, HOY, actorProfesorAjeno)
    expect(detalle.turnoId).toBe(31)
    expect(detalle.pago).toBeNull()
    expect(detalle.acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
      registrarAsistencia: { visible: false },
    })
    expect(detalle.horasSeguidas?.ocurrencias.map((hora) => hora.registrable)).toEqual([
      false,
      false,
    ])
  })

  it('profesor dueño del turno: ve el detalle sin operar ni cobrar (sin plazo, tampoco registra)', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorProfesorDueño)
    expect(detalle.turnoId).toBe(31)
    expect(detalle.acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
      registrarAsistencia: { visible: false },
    })
    expect(repos.repository.profesorTieneAlumno).not.toHaveBeenCalled()
  })

  it('profesor dueño del turno: no ve el pago (`pago: null`), ni pendiente ni pagado, y no se consulta', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))
    expect((await service.obtenerDetalle(31, HOY, actorProfesorDueño)).pago).toBeNull()

    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 7500 },
      }),
    )
    expect((await service.obtenerDetalle(31, HOY, actorProfesorDueño)).pago).toBeNull()
    expect(repos.repository.buscarPago).not.toHaveBeenCalled()
  })

  it('pendiente: `pago` trae el importe vigente de la materia, sin consultar ningún pago', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: 8000 })
    expect(detalle.acciones.registrarPago).toEqual({ visible: true })
    expect(detalle.acciones.cancelar).toEqual({ visible: true, habilitada: true })
    expect(repos.repository.buscarPago).not.toHaveBeenCalled()
  })

  it('pendiente y la materia no tiene precio: `importeVigente: null`; el botón se ofrece igual (decide el 409 SIN_PRECIO)', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))
    repos.repository.buscarDatosAdicionales.mockResolvedValue({
      ...DATOS_ADICIONALES,
      precioVigente: null,
    })

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: null })
    expect(detalle.acciones.registrarPago).toEqual({ visible: true })
  })

  it('pendiente y posterior al tope de cobro (hoy + 56): no se ofrece registrar el pago', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: '2026-11-18' }))

    const detalle = await service.obtenerDetalle(31, '2026-11-18', actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: 8000 })
    expect(detalle.acciones.registrarPago).toEqual({ visible: false })
  })

  it('pagada: `pago` con los datos de su pago, cancelar deshabilitada con su motivo y sin registrarPago', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 8000 },
      }),
    )
    repos.repository.buscarPago.mockResolvedValue(PAGO)

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.buscarPago).toHaveBeenCalledExactlyOnceWith(31)
    expect(detalle.pago).toEqual({
      estado: 'PAGADO',
      pagoId: 31,
      numeroComprobante: 1024,
      importe: 8000,
      formaPago: { id: 1, nombre: 'Efectivo' },
      fechaPago: '2026-09-20',
      registradoPor: { id: 'usr_mesa', nombre: 'Marta', apellido: 'Ruiz' },
      registradoEl: '2026-09-20T14:30:00.000Z',
    })
    expect(detalle.acciones.cancelar).toEqual({
      visible: true,
      habilitada: false,
      motivo: 'El turno está pagado: no se puede cancelar',
    })
    expect(detalle.acciones.registrarPago).toEqual({ visible: false })
    // Una pagada se reprograma: el pago acompaña al turno (HU-20).
    expect(detalle.acciones.reprogramar).toEqual({ visible: true })
    // Finalizar sale de las filas de la hora (vigente y sin finalizar), no del pago.
    expect(detalle.acciones.finalizar).toEqual({ visible: true })
  })

  it('pagada y después cambió el precio de la materia: `importe` sigue siendo el que se cobró', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 7500 },
      }),
    )
    repos.repository.buscarDatosAdicionales.mockResolvedValue({
      ...DATOS_ADICIONALES,
      precioVigente: 9000,
    })
    repos.repository.buscarPago.mockResolvedValue(PAGO)

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.pago).toMatchObject({ estado: 'PAGADO', importe: 7500 })
    expect(JSON.stringify(detalle.pago)).not.toContain('9000')
  })

  it('pagada pero su pago no aparece (inconsistencia): 500, no un detalle a medias', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 8000 },
      }),
    )
    repos.repository.buscarPago.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorMesa))
    expect(error.statusCode).toBe(500)
  })

  it('MESA_ENTRADAS no tiene la restricción de dueño (no consulta al profesor)', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.profesoresRepository.buscarIdPorUsuario).not.toHaveBeenCalled()
  })

  it('arma el DTO campo por campo: DNI del alumno, horas en HH:mm, sin `busqueda`', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.alumno).toEqual({
      id: 12,
      nombre: 'Lucía',
      apellido: 'González',
      dni: '40123456',
    })
    expect(detalle.horaInicio).toBe('09:00')
    expect(detalle.horaFin).toBe('10:00')
    expect(detalle.observaciones).toBeNull()
    expect(detalle.temas).toBeNull()
    expect(detalle.createdBy).toEqual({
      id: 'usr_1',
      nombre: 'Ana',
      apellido: 'Pérez',
      rol: 'MESA_ENTRADAS',
    })
    expect(JSON.stringify(detalle)).not.toContain('busqueda')
  })

  it('sesión única: no pide las filas de la hora ni la finalización (no aplica)', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY, tipo: 'SESION_UNICA' }))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.leerFilasDeLaHora).not.toHaveBeenCalled()
    expect(repos.repository.buscarFinalizacion).not.toHaveBeenCalled()
    expect(detalle.acciones.finalizar).toEqual({ visible: false })
    expect(detalle.serie.finalizacion).toBeNull()
  })

  it('recurrente finalizada: trae la finalización', async () => {
    const finalizacion: Finalizacion = {
      fechaDesde: '2026-10-06',
      motivo: 'PROBLEMA_ADMINISTRATIVO',
      detalle: 'Se dio de baja la materia',
      createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
      createdAt: '2026-10-01T12:00:00.000Z',
    }
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        tipo: 'RECURRENTE',
        serie: {
          serieId: null,
          fechaInicio: '2026-03-02',
          fechaFin: null,
          finEfectivo: '2026-10-05',
        },
      }),
    )
    repos.repository.leerFilasDeLaHora.mockResolvedValue([
      filaDeLaHora({ finalizadaDesde: '2026-10-06' }),
    ])
    repos.repository.buscarFinalizacion.mockResolvedValue(finalizacion)

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.buscarFinalizacion).toHaveBeenCalledWith([31])
    expect(detalle.serie.finalizacion).toEqual(finalizacion)
    expect(detalle.acciones.finalizar).toEqual({ visible: false })
  })

  it('recurrente sin finalizar: no pide la finalización y ofrece finalizar', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.leerFilasDeLaHora).toHaveBeenCalledWith(31)
    expect(repos.repository.buscarFinalizacion).not.toHaveBeenCalled()
    expect(detalle.serie.finalizacion).toBeNull()
    expect(detalle.acciones.finalizar).toEqual({ visible: true })
  })

  it('tramo anterior de una hora finalizada en un tramo posterior: muestra esa finalización y no ofrece finalizar', async () => {
    const finalizacion: Finalizacion = {
      fechaDesde: '2026-11-16',
      motivo: 'CANCELACION_ALUMNO',
      detalle: null,
      createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
      createdAt: '2026-10-01T12:00:00.000Z',
    }
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))
    // La hora del turno 31 tiene dos tramos; la finalización está registrada en el posterior (58).
    repos.repository.leerFilasDeLaHora.mockResolvedValue([
      filaDeLaHora({ fechaFin: '2026-10-19' }),
      filaDeLaHora({ turnoId: 58, fechaInicio: '2026-11-02', finalizadaDesde: '2026-11-16' }),
    ])
    repos.repository.buscarFinalizacion.mockResolvedValue(finalizacion)

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.buscarFinalizacion).toHaveBeenCalledWith([58])
    expect(detalle.serie.finalizacion).toEqual(finalizacion)
    expect(detalle.acciones.finalizar).toEqual({ visible: false })
  })

  it('la otra hora de la serie: sus filas no tienen finalización → ofrece finalizar', async () => {
    // El repository sólo devuelve las filas de la hora del turno pedido (acá, la de 10): la
    // finalización de la hora de 9 de la misma serie no entra.
    delDia(
      ocurrencia({ turnoId: 42, fecha: HOY, bloqueAgendaId: 11, horaInicio: 600, horaFin: 660 }),
    )
    repos.repository.leerFilasDeLaHora.mockResolvedValue([
      filaDeLaHora({ turnoId: 42, bloqueAgendaId: 11, horaInicio: 600, horaFin: 660 }),
    ])

    const detalle = await service.obtenerDetalle(42, HOY, actorMesa)
    expect(repos.repository.leerFilasDeLaHora).toHaveBeenCalledWith(42)
    expect(detalle.serie.finalizacion).toBeNull()
    expect(detalle.acciones.finalizar).toEqual({ visible: true })
  })

  it('cancelada: resuelve quién canceló (el motor sólo trae el id) y no pide prioridad', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: HOY,
        estado: 'CANCELADO',
        cancelacion: {
          motivo: 'CANCELACION_ALUMNO',
          detalle: null,
          createdById: 'usr_2',
          createdAt: '2026-09-20T10:00:00.000Z',
        },
      }),
    )
    repos.repository.resolverUsuarioAuditoria.mockResolvedValue({
      id: 'usr_2',
      nombre: 'Bruno',
      apellido: 'Álvarez',
    })

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.resolverUsuarioAuditoria).toHaveBeenCalledWith('usr_2')
    expect(detalle.cancelacion).toEqual({
      motivo: 'CANCELACION_ALUMNO',
      detalle: null,
      createdAt: '2026-09-20T10:00:00.000Z',
      createdBy: { id: 'usr_2', nombre: 'Bruno', apellido: 'Álvarez' },
    })
    expect(detalle.prioridad).toBeNull()
    expect(detalle.examen).toBeNull()
    expect(repos.repository.leerPrioridades).not.toHaveBeenCalled()
    // `cancelar`/`reprogramar`/`registrarPago` ya no aplican; `finalizar` no depende del estado de
    // esta ocurrencia puntual, sino de la serie (acá recurrente, vigente y sin finalizar).
    expect(detalle.acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: true },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
      registrarAsistencia: { visible: false },
    })
  })

  it('no cancelada: pide la prioridad y la incluye con el examen que la determina', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: HOY }))
    repos.repository.leerPrioridades.mockResolvedValue(
      new Map([
        [
          '12-3-2026-09-22',
          {
            prioridad: 'ALTA',
            examen: {
              id: 8,
              fecha: '2026-09-29',
              tipo: 'PARCIAL',
              materiaNombre: 'Matemática',
              dias: 7,
            },
          },
        ],
      ]),
    )

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.repository.leerPrioridades).toHaveBeenCalledWith([
      { alumnoId: 12, materiaId: 3, fecha: HOY },
    ])
    expect(detalle.prioridad).toBe('ALTA')
    expect(detalle.examen).toEqual({
      id: 8,
      fecha: '2026-09-29',
      tipo: 'PARCIAL',
      materiaNombre: 'Matemática',
      dias: 7,
    })
  })

  it('pasada (SIN_REGISTRAR): cancelar y reprogramar no visibles', async () => {
    delDia(ocurrencia({ turnoId: 31, fecha: '2026-09-01', estado: 'SIN_REGISTRAR' }))

    const detalle = await service.obtenerDetalle(31, '2026-09-01', actorMesa)
    expect(detalle.acciones.cancelar).toEqual({ visible: false, habilitada: false })
    expect(detalle.acciones.reprogramar).toEqual({ visible: false })
  })
})

// ---------------------------------------------------------------------------------------------
// obtenerDetalle: asistencia de la hora y `createdBy` con su rol (T-84)
// ---------------------------------------------------------------------------------------------

describe('obtenerDetalle: asistencia de la hora (T-84)', () => {
  // Reloj fijo en HOY (22/09): el 21/09 está dentro del plazo (vence el 28/09) y el 14/09 es el día
  // 8 (venció el 21/09). El plazo lo calcula el motor; acá viene en la ocurrencia, como lo da.
  const AYER = '2026-09-21'
  const DIA_8 = '2026-09-14'
  const EN_PLAZO = { vence: '2026-09-28', vencido: false }
  const VENCIDO = { vence: '2026-09-21', vencido: true }
  const ANA = { id: 'usr_ana', nombre: 'Ana', apellido: 'Pérez' }
  const BRUNO = { id: 'usr_bruno', nombre: 'Bruno', apellido: 'Álvarez' }

  /** Asistencia registrada por Ana el 21/09, sin corregir. */
  function asistencia(
    datos: Partial<NonNullable<Ocurrencia['asistencia']>> = {},
  ): NonNullable<Ocurrencia['asistencia']> {
    return {
      estado: 'PRESENTE',
      trabajado: 'Fracciones',
      indicaciones: 'Guía 3',
      observacion: null,
      createdById: 'usr_ana',
      createdAt: '2026-09-21T15:00:00.000Z',
      updatedById: 'usr_ana',
      updatedAt: '2026-09-21T15:00:00.000Z',
      ...datos,
    }
  }

  beforeEach(() => {
    repos.repository.resolverUsuariosAuditoria.mockResolvedValue(
      new Map([
        [ANA.id, ANA],
        [BRUNO.id, BRUNO],
      ]),
    )
  })

  it('presente con textos: el detalle completo, con la asistencia y su auditoría', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: AYER,
        estado: 'REALIZADO',
        asistencia: asistencia(),
        plazoAsistencia: EN_PLAZO,
      }),
    )

    const detalle = await service.obtenerDetalle(31, AYER, actorMesa)
    expect(repos.repository.resolverUsuariosAuditoria).toHaveBeenCalledExactlyOnceWith(['usr_ana'])
    expect(detalle).toEqual({
      turnoId: 31,
      fecha: AYER,
      alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      aula: { id: 3, nombre: 'Aula 3' },
      horaInicio: '09:00',
      horaFin: '10:00',
      tipo: 'RECURRENTE',
      serie: { fechaInicio: AYER, fechaFin: null, finalizacion: null },
      estado: 'REALIZADO',
      observaciones: null,
      temas: null,
      cancelacion: null,
      pago: { estado: 'PENDIENTE', importeVigente: 8000 },
      prioridad: null,
      examen: null,
      plazoAsistencia: { vence: '2026-09-28', vencido: false },
      asistencia: {
        estado: 'PRESENTE',
        trabajado: 'Fracciones',
        indicaciones: 'Guía 3',
        observacion: null,
        registradaPor: ANA,
        registradaEl: '2026-09-21T15:00:00.000Z',
        modificadaPor: ANA,
        modificadaEl: '2026-09-21T15:00:00.000Z',
        cerradaPorSistema: false,
      },
      horasSeguidas: null,
      // Con asistencia: ni cancelar ni reprogramar; el cobro sí, porque está impaga.
      acciones: {
        cancelar: { visible: false, habilitada: false },
        finalizar: { visible: true },
        reprogramar: { visible: false },
        registrarPago: { visible: true },
        registrarAsistencia: { visible: false },
      },
      createdAt: '2026-08-01T13:00:00.000Z',
      updatedAt: '2026-08-01T13:00:00.000Z',
      createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez', rol: 'MESA_ENTRADAS' },
      updatedBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
    })
  })

  it('ausente con observación: sin textos y con la observación de esa hora', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: AYER,
        estado: 'AUSENTE',
        asistencia: asistencia({
          estado: 'AUSENTE',
          trabajado: null,
          indicaciones: null,
          observacion: 'Avisó que estaba enfermo',
        }),
        plazoAsistencia: EN_PLAZO,
      }),
    )

    const detalle = await service.obtenerDetalle(31, AYER, actorMesa)
    expect(detalle.estado).toBe('AUSENTE')
    expect(detalle.asistencia).toEqual({
      estado: 'AUSENTE',
      trabajado: null,
      indicaciones: null,
      observacion: 'Avisó que estaba enfermo',
      registradaPor: ANA,
      registradaEl: '2026-09-21T15:00:00.000Z',
      modificadaPor: ANA,
      modificadaEl: '2026-09-21T15:00:00.000Z',
      cerradaPorSistema: false,
    })
  })

  it('corregida por otro usuario: resuelve los dos en una sola consulta, con su otro instante', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: AYER,
        estado: 'REALIZADO',
        asistencia: asistencia({
          trabajado: 'Decimales',
          updatedById: 'usr_bruno',
          updatedAt: '2026-09-22T10:00:00.000Z',
        }),
        plazoAsistencia: EN_PLAZO,
      }),
    )

    const detalle = await service.obtenerDetalle(31, AYER, actorMesa)
    expect(repos.repository.resolverUsuariosAuditoria).toHaveBeenCalledExactlyOnceWith([
      'usr_ana',
      'usr_bruno',
    ])
    expect(detalle.asistencia).toEqual({
      estado: 'PRESENTE',
      trabajado: 'Decimales',
      indicaciones: 'Guía 3',
      observacion: null,
      registradaPor: ANA,
      registradaEl: '2026-09-21T15:00:00.000Z',
      modificadaPor: BRUNO,
      modificadaEl: '2026-09-22T10:00:00.000Z',
      cerradaPorSistema: false,
    })
  })

  it('sin registrar dentro del plazo: `asistencia: null` con su plazo, sin resolver usuarios', async () => {
    delDia(
      ocurrencia({ turnoId: 31, fecha: AYER, estado: 'SIN_REGISTRAR', plazoAsistencia: EN_PLAZO }),
    )

    const detalle = await service.obtenerDetalle(31, AYER, actorMesa)
    expect(detalle.asistencia).toBeNull()
    expect(detalle.plazoAsistencia).toEqual({ vence: '2026-09-28', vencido: false })
    expect(repos.repository.resolverUsuariosAuditoria).not.toHaveBeenCalled()
  })

  it('el día 8 sin registrar: cerrada por el sistema, sin estado ni personas', async () => {
    delDia(
      ocurrencia({ turnoId: 31, fecha: DIA_8, estado: 'SIN_REGISTRAR', plazoAsistencia: VENCIDO }),
    )

    const detalle = await service.obtenerDetalle(31, DIA_8, actorMesa)
    expect(detalle.plazoAsistencia).toEqual({ vence: '2026-09-21', vencido: true })
    expect(detalle.asistencia).toEqual({
      estado: null,
      trabajado: null,
      indicaciones: null,
      observacion: OBSERVACION_CIERRE_SISTEMA,
      registradaPor: null,
      registradaEl: null,
      modificadaPor: null,
      modificadaEl: null,
      cerradaPorSistema: true,
    })
    expect(repos.repository.resolverUsuariosAuditoria).not.toHaveBeenCalled()
  })

  it('cancelada con una asistencia en la base: `asistencia: null` (el estado manda, T-137)', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: AYER,
        estado: 'CANCELADO',
        cancelacion: {
          motivo: 'CANCELACION_ALUMNO',
          detalle: null,
          createdById: 'usr_bruno',
          createdAt: '2026-09-20T10:00:00.000Z',
        },
        asistencia: asistencia(),
        plazoAsistencia: null,
      }),
    )
    repos.repository.resolverUsuarioAuditoria.mockResolvedValue(BRUNO)

    const detalle = await service.obtenerDetalle(31, AYER, actorMesa)
    expect(detalle.estado).toBe('CANCELADO')
    expect(detalle.asistencia).toBeNull()
    expect(detalle.plazoAsistencia).toBeNull()
    expect(repos.repository.resolverUsuariosAuditoria).not.toHaveBeenCalled()
  })

  it.each(['ALUMNO', 'MESA_ENTRADAS'] as const)(
    '`createdBy` trae el rol de quien registró el turno: %s',
    async (rol) => {
      delDia(ocurrencia({ turnoId: 31, fecha: HOY }))
      repos.repository.buscarDatosAdicionales.mockResolvedValue({
        ...DATOS_ADICIONALES,
        createdBy: { id: 'usr_x', nombre: 'Lucía', apellido: 'González', rol },
      })

      const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
      expect(detalle.createdBy).toEqual({ id: 'usr_x', nombre: 'Lucía', apellido: 'González', rol })
      expect(detalle.updatedBy).toEqual({ id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' })
    },
  )
})

// ---------------------------------------------------------------------------------------------
// obtenerDetalle: horas seguidas y registrarAsistencia (T-84)
// ---------------------------------------------------------------------------------------------

describe('obtenerDetalle: horas seguidas y registrarAsistencia (T-84)', () => {
  const AYER = '2026-09-21'
  const PLAZO_HOY = { vence: '2026-09-29', vencido: false }
  const PLAZO_AYER = { vence: '2026-09-28', vencido: false }
  const VENCIDO = { vence: '2026-09-21', vencido: true }
  const ANA = { id: 'usr_ana', nombre: 'Ana', apellido: 'Pérez' }

  /**
   * Una hora de Lucas (alumno 12) con el profesor 4 en la materia 3, de `desde` a `desde + 1`
   * (en horas), hoy y con el plazo abierto, salvo lo que se pise.
   */
  function hora(turnoId: number, desde: number, datos: Partial<Ocurrencia> = {}): Ocurrencia {
    return ocurrencia({
      turnoId,
      fecha: HOY,
      horaInicio: desde * 60,
      horaFin: (desde + 1) * 60,
      plazoAsistencia: PLAZO_HOY,
      ...datos,
    })
  }

  /** Una asistencia de Ana, presente con esos textos o ausente con esa observación. */
  function registrada(
    estado: 'PRESENTE' | 'AUSENTE',
    textos: { trabajado?: string | null; indicaciones?: string | null; observacion?: string } = {},
  ): NonNullable<Ocurrencia['asistencia']> {
    return {
      estado,
      trabajado: textos.trabajado ?? null,
      indicaciones: textos.indicaciones ?? null,
      observacion: textos.observacion ?? null,
      createdById: 'usr_ana',
      createdAt: '2026-09-21T15:00:00.000Z',
      updatedById: 'usr_ana',
      updatedAt: '2026-09-21T15:00:00.000Z',
    }
  }

  beforeEach(() => {
    repos.repository.resolverUsuariosAuditoria.mockResolvedValue(new Map([[ANA.id, ANA]]))
  })

  /** Una hora de `horasSeguidas.ocurrencias` sin registrar, con lo que no cambia en estos tests. */
  const horaSeguida = (turnoId: number, desde: number, actual: boolean) => ({
    turnoId,
    fecha: HOY,
    horaInicio: `${String(desde).padStart(2, '0')}:00`,
    horaFin: `${String(desde + 1).padStart(2, '0')}:00`,
    estado: 'AGENDADO',
    plazoAsistencia: PLAZO_HOY,
    actual,
    registrable: false,
    textosPropios: null,
    observacion: null,
  })

  it('Lucas de 8 a 9, de 9 a 10 y de 20 a 21: los dos primeros traen el mismo grupo; el de 20, null', async () => {
    delDia(hora(31, 8), hora(32, 9), hora(33, 20))

    const de8 = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(de8.horasSeguidas).toEqual({
      horaInicio: '08:00',
      horaFin: '10:00',
      horas: 2,
      textos: null,
      ocurrencias: [horaSeguida(31, 8, true), horaSeguida(32, 9, false)],
    })

    const de9 = await service.obtenerDetalle(32, HOY, actorMesa)
    expect(de9.horasSeguidas).toEqual({
      horaInicio: '08:00',
      horaFin: '10:00',
      horas: 2,
      textos: null,
      ocurrencias: [horaSeguida(31, 8, false), horaSeguida(32, 9, true)],
    })

    const de20 = await service.obtenerDetalle(33, HOY, actorMesa)
    expect(de20.horasSeguidas).toBeNull()

    // Una lectura del motor por detalle, ninguna por hora.
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledTimes(3)
  })

  it('una hora cancelada en el medio corta el grupo; la cancelada no tiene horas seguidas', async () => {
    delDia(hora(31, 8), hora(32, 9, { estado: 'CANCELADO', plazoAsistencia: null }), hora(33, 10))

    expect((await service.obtenerDetalle(31, HOY, actorMesa)).horasSeguidas).toBeNull()
    expect((await service.obtenerDetalle(33, HOY, actorMesa)).horasSeguidas).toBeNull()
    expect((await service.obtenerDetalle(32, HOY, actorMesa)).horasSeguidas).toBeNull()
  })

  it.each([
    ['otra materia', { materiaId: 7 }],
    ['otro profesor', { profesorId: 9 }],
  ] as const)('%s en la hora siguiente no entra en el grupo', async (_caso, cambio) => {
    delDia(hora(31, 8), hora(32, 9, cambio))

    expect((await service.obtenerDetalle(31, HOY, actorMesa)).horasSeguidas).toBeNull()
  })

  it('cada hora con su estado: REALIZADO y SIN_REGISTRAR, registrable sólo la sin registrar', async () => {
    delDia(
      hora(31, 8, {
        fecha: AYER,
        estado: 'REALIZADO',
        asistencia: registrada('PRESENTE', { trabajado: 'Fracciones' }),
        plazoAsistencia: PLAZO_AYER,
      }),
      hora(32, 9, { fecha: AYER, estado: 'SIN_REGISTRAR', plazoAsistencia: PLAZO_AYER }),
    )

    const detalle = await service.obtenerDetalle(31, AYER, actorProfesorDueño)
    expect(
      detalle.horasSeguidas?.ocurrencias.map((h) => [h.turnoId, h.estado, h.registrable]),
    ).toEqual([
      [31, 'REALIZADO', false],
      [32, 'SIN_REGISTRAR', true],
    ])
    // La propia ya está registrada y en plazo: el profesor la puede corregir.
    expect(detalle.acciones.registrarAsistencia).toEqual({ visible: true })
  })

  it('los textos una vez, `textosPropios` sólo en la hora corregida y la observación del ausente', async () => {
    const fracciones = { trabajado: 'Fracciones', indicaciones: 'Guía 3' }
    delDia(
      hora(31, 8, { estado: 'REALIZADO', asistencia: registrada('PRESENTE', fracciones) }),
      hora(32, 9, {
        estado: 'REALIZADO',
        asistencia: registrada('PRESENTE', { ...fracciones, trabajado: 'Decimales' }),
      }),
      hora(33, 10, { estado: 'REALIZADO', asistencia: registrada('PRESENTE', fracciones) }),
      hora(34, 11, {
        estado: 'AUSENTE',
        asistencia: registrada('AUSENTE', { observacion: 'Se retiró antes' }),
      }),
    )

    const grupo = (await service.obtenerDetalle(33, HOY, actorMesa)).horasSeguidas
    expect(grupo?.textos).toEqual({ trabajado: 'Fracciones', indicaciones: 'Guía 3' })
    expect(grupo?.ocurrencias.map((h) => h.textosPropios)).toEqual([
      null,
      { trabajado: 'Decimales', indicaciones: 'Guía 3' },
      null,
      null,
    ])
    expect(grupo?.ocurrencias.map((h) => h.observacion)).toEqual([
      null,
      null,
      null,
      'Se retiró antes',
    ])
    expect(grupo?.ocurrencias.map((h) => h.actual)).toEqual([false, false, true, false])
  })

  it('registrarAsistencia: visible para el profesor del turno dentro del plazo, con sus horas sin registrar registrables', async () => {
    delDia(hora(31, 8), hora(32, 9))

    const detalle = await service.obtenerDetalle(31, HOY, actorProfesorDueño)
    expect(detalle.acciones.registrarAsistencia).toEqual({ visible: true })
    expect(detalle.horasSeguidas?.ocurrencias.map((h) => h.registrable)).toEqual([true, true])
  })

  it('registrarAsistencia: no visible con el plazo vencido, y ninguna hora registrable', async () => {
    const DIA_8 = '2026-09-14'
    delDia(
      hora(31, 8, { fecha: DIA_8, estado: 'SIN_REGISTRAR', plazoAsistencia: VENCIDO }),
      hora(32, 9, { fecha: DIA_8, estado: 'SIN_REGISTRAR', plazoAsistencia: VENCIDO }),
    )

    const detalle = await service.obtenerDetalle(31, DIA_8, actorProfesorDueño)
    expect(detalle.acciones.registrarAsistencia).toEqual({ visible: false })
    expect(detalle.horasSeguidas?.ocurrencias.map((h) => h.registrable)).toEqual([false, false])
  })

  it('registrarAsistencia: no visible para la mesa de entrada, ni registrable ninguna hora', async () => {
    delDia(hora(31, 8), hora(32, 9))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.acciones.registrarAsistencia).toEqual({ visible: false })
    expect(detalle.horasSeguidas?.ocurrencias.map((h) => h.registrable)).toEqual([false, false])
  })

  it('registrarAsistencia: no visible para un profesor ajeno con turnos con el alumno', async () => {
    repos.repository.profesorTieneAlumno.mockResolvedValue(true)
    delDia(hora(31, 8), hora(32, 9))

    const detalle = await service.obtenerDetalle(31, HOY, actorProfesorAjeno)
    expect(detalle.acciones.registrarAsistencia).toEqual({ visible: false })
    expect(detalle.horasSeguidas?.ocurrencias.map((h) => h.registrable)).toEqual([false, false])
  })
})

// ---------------------------------------------------------------------------------------------
// listarDelAlumno
// ---------------------------------------------------------------------------------------------

describe('listarDelAlumno', () => {
  beforeEach(() => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
  })

  it('sin desde/hasta, usa la ventana por defecto (el año en curso completo)', async () => {
    await service.listarDelAlumno({ alumnoId: 12 })

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      { desde: '2026-01-01', hasta: '2026-12-31', alumnoId: 12 },
      relojFijo,
    )
  })

  it('respeta un rango explícito dentro de la ventana', async () => {
    await service.listarDelAlumno({ alumnoId: 12, desde: '2026-09-01', hasta: '2026-09-30' })

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      { desde: '2026-09-01', hasta: '2026-09-30', alumnoId: 12 },
      relojFijo,
    )
  })

  it('`hasta` anterior a `desde` → 400 sobre `hasta`, sin consultar', async () => {
    const error = await errorDe(
      service.listarDelAlumno({ alumnoId: 12, desde: '2026-09-10', hasta: '2026-09-05' }),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('un rango fuera de la ventana → 400 sobre `hasta`', async () => {
    const error = await errorDe(
      service.listarDelAlumno({ alumnoId: 12, desde: '2025-08-01', hasta: '2025-09-30' }),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_FUERA_DE_VENTANA }])
  })

  it('incluye las canceladas, con prioridad `null` y sin pedirla para ellas', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }),
      ocurrencia({ turnoId: 2, fecha: HOY, estado: 'CANCELADO' }),
    ])
    repos.repository.leerPrioridades.mockResolvedValue(
      new Map([['12-3-2026-09-22', { prioridad: 'MEDIA' }]]),
    )

    const items = await service.listarDelAlumno({ alumnoId: 12 })
    expect(repos.repository.leerPrioridades).toHaveBeenCalledWith([
      { alumnoId: 12, materiaId: 3, fecha: HOY },
    ])
    expect(items).toEqual([
      expect.objectContaining({
        turnoId: 1,
        estado: 'AGENDADO',
        prioridad: 'MEDIA',
        cancelable: true,
      }),
      expect.objectContaining({
        turnoId: 2,
        estado: 'CANCELADO',
        prioridad: null,
        cancelable: false,
      }),
    ])
  })

  it('arma cada ítem campo por campo (horas en HH:mm), sin `busqueda`', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }),
    ])

    const items = await service.listarDelAlumno({ alumnoId: 12 })
    expect(JSON.stringify(items)).not.toContain('busqueda')
    expect(items[0]).toEqual({
      turnoId: 1,
      fecha: HOY,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '10:00',
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      materia: { id: 3, nombre: 'Matemática' },
      tipo: 'RECURRENTE',
      estado: 'AGENDADO',
      estadoPago: 'PENDIENTE',
      prioridad: null,
      cancelable: true,
      plazoAsistencia: null,
    })
  })

  it('cada ítem lleva su `plazoAsistencia` del motor, sin asistencia ni horas seguidas', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([
      ocurrencia({
        turnoId: 1,
        fecha: '2026-09-21',
        estado: 'REALIZADO',
        asistencia: {
          estado: 'PRESENTE',
          trabajado: 'Fracciones',
          indicaciones: null,
          observacion: null,
          createdById: 'usr_ana',
          createdAt: '2026-09-21T15:00:00.000Z',
          updatedById: 'usr_ana',
          updatedAt: '2026-09-21T15:00:00.000Z',
        },
        plazoAsistencia: { vence: '2026-09-28', vencido: false },
      }),
      ocurrencia({
        turnoId: 1,
        fecha: '2026-09-14',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-09-21', vencido: true },
      }),
      ocurrencia({ turnoId: 1, fecha: '2026-09-28' }),
    ])

    const items = await service.listarDelAlumno({ alumnoId: 12 })
    expect(items.map((item) => item.plazoAsistencia)).toEqual([
      { vence: '2026-09-28', vencido: false },
      { vence: '2026-09-21', vencido: true },
      null,
    ])
    for (const item of items) {
      expect(item).not.toHaveProperty('asistencia')
      expect(item).not.toHaveProperty('horasSeguidas')
    }
    expect(repos.repository.resolverUsuariosAuditoria).not.toHaveBeenCalled()
  })

  it('cada ítem lleva su `estadoPago`; una pagada no es `cancelable`, y no se consulta ningún pago', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }),
      ocurrencia({
        turnoId: 2,
        fecha: HOY,
        pago: { estado: 'PAGADO', pagoId: 31, importeAplicado: 8000 },
      }),
    ])

    const items = await service.listarDelAlumno({ alumnoId: 12 })
    expect(items).toEqual([
      expect.objectContaining({ turnoId: 1, estadoPago: 'PENDIENTE', cancelable: true }),
      expect.objectContaining({ turnoId: 2, estadoPago: 'PAGADO', cancelable: false }),
    ])
    expect(repos.repository.buscarPago).not.toHaveBeenCalled()
    expect(repos.repository.buscarDatosAdicionales).not.toHaveBeenCalled()
  })

  it('sin turnos en el rango, devuelve un arreglo vacío', async () => {
    await expect(service.listarDelAlumno({ alumnoId: 12 })).resolves.toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// Portal (HU-30): misTurnos y miTurno
// ---------------------------------------------------------------------------------------------

describe('portal: misTurnos', () => {
  const RANGO = { desde: '2026-09-01', hasta: '2026-09-30' }

  it('las ocurrencias del alumno de la sesión en el rango, incluidas las canceladas, campo por campo', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([
      ocurrencia({ turnoId: 1, fecha: HOY }),
      ocurrencia({ turnoId: 2, fecha: HOY, estado: 'CANCELADO' }),
    ])

    const turnos = await service.misTurnos(RANGO, actorAlumno)
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledExactlyOnceWith(
      { ...RANGO, alumnoId: 12 },
      relojFijo,
    )
    expect(turnos).toEqual([
      {
        turnoId: 1,
        fecha: HOY,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        materia: { id: 3, nombre: 'Matemática' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
        aula: { id: 3, nombre: 'Aula 3' },
        tipo: 'RECURRENTE',
        estado: 'AGENDADO',
        estadoPago: 'PENDIENTE',
      },
      expect.objectContaining({ turnoId: 2, estado: 'CANCELADO' }),
    ])
    expect(repos.repository.leerPrioridades).not.toHaveBeenCalled()
  })

  it('un rango de 31 días (extremos incluidos) se acepta', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([])
    await expect(
      service.misTurnos({ desde: '2026-10-01', hasta: '2026-10-31' }, actorAlumno),
    ).resolves.toEqual([])
  })

  it('un rango de 32 días → 400 en `hasta`, sin leer el motor', async () => {
    const error = await errorDe(
      service.misTurnos({ desde: '2026-10-01', hasta: '2026-11-01' }, actorAlumno),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_MIS_TURNOS }])
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('un rango invertido → 400 en `hasta`', async () => {
    const error = await errorDe(
      service.misTurnos({ desde: '2026-10-10', hasta: '2026-10-01' }, actorAlumno),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }])
  })

  it('un actor sin alumno (otro rol) → 403, sin leer el motor', async () => {
    const error = await errorDe(service.misTurnos(RANGO, actorMesa))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })
})

describe('portal: miTurno', () => {
  const AYER = '2026-09-21'
  const PLAZO = { vence: '2026-09-28', vencido: false }
  const presente = (trabajado: string): NonNullable<Ocurrencia['asistencia']> => ({
    estado: 'PRESENTE',
    trabajado,
    indicaciones: 'Guía 3',
    observacion: null,
    createdById: 'usr_ana',
    createdAt: '2026-09-21T15:00:00.000Z',
    updatedById: 'usr_ana',
    updatedAt: '2026-09-21T15:00:00.000Z',
  })
  /** Lucas ayer de 8 a 9 y de 9 a 10, las dos presentes; la segunda corregida con otro texto. */
  const deOcho = () =>
    ocurrencia({
      turnoId: 31,
      fecha: AYER,
      horaInicio: 480,
      horaFin: 540,
      estado: 'REALIZADO',
      asistencia: presente('Fracciones'),
      plazoAsistencia: PLAZO,
      pago: { estado: 'PAGADO', pagoId: 5, importeAplicado: 8000 },
    })
  const deNueve = () =>
    ocurrencia({
      turnoId: 32,
      fecha: AYER,
      horaInicio: 540,
      horaFin: 600,
      estado: 'REALIZADO',
      asistencia: presente('Decimales'),
      plazoAsistencia: PLAZO,
    })

  it('el propio alumno ve su turno con la asistencia sin auditoría y sus horas seguidas', async () => {
    repos.repository.buscarDatosAdicionales.mockResolvedValue({
      ...DATOS_ADICIONALES,
      temas: 'Fracciones',
      observaciones: 'Interna: no la ve el alumno',
    })
    delDia(deOcho(), deNueve())

    const detalle = await service.miTurno(31, AYER, actorAlumno)
    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledExactlyOnceWith(
      { desde: AYER, hasta: AYER, alumnoId: 12 },
      relojFijo,
    )
    expect(detalle).toEqual({
      turnoId: 31,
      fecha: AYER,
      horaInicio: '08:00',
      horaFin: '09:00',
      materia: { id: 3, nombre: 'Matemática' },
      profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      aula: { id: 3, nombre: 'Aula 3' },
      tipo: 'RECURRENTE',
      temas: 'Fracciones',
      estado: 'REALIZADO',
      plazoAsistencia: PLAZO,
      estadoPago: 'PAGADO',
      asistencia: {
        estado: 'PRESENTE',
        trabajado: 'Fracciones',
        indicaciones: 'Guía 3',
        cerradaPorSistema: false,
      },
      horasSeguidas: {
        horaInicio: '08:00',
        horaFin: '10:00',
        horas: 2,
        textos: { trabajado: 'Fracciones', indicaciones: 'Guía 3' },
        ocurrencias: [
          {
            turnoId: 31,
            fecha: AYER,
            horaInicio: '08:00',
            horaFin: '09:00',
            estado: 'REALIZADO',
            plazoAsistencia: PLAZO,
            actual: true,
            textosPropios: null,
          },
          {
            turnoId: 32,
            fecha: AYER,
            horaInicio: '09:00',
            horaFin: '10:00',
            estado: 'REALIZADO',
            plazoAsistencia: PLAZO,
            actual: false,
            textosPropios: { trabajado: 'Decimales', indicaciones: 'Guía 3' },
          },
        ],
      },
    })
    // Ni la auditoría de la asistencia ni los datos del pago: no se resuelve nada más.
    expect(repos.repository.resolverUsuariosAuditoria).not.toHaveBeenCalled()
    expect(repos.repository.buscarPago).not.toHaveBeenCalled()
  })

  it('cerrada por el sistema: sin estado ni textos, y sin la observación del cierre', async () => {
    delDia(
      ocurrencia({
        turnoId: 31,
        fecha: '2026-09-14',
        estado: 'SIN_REGISTRAR',
        plazoAsistencia: { vence: '2026-09-21', vencido: true },
      }),
    )

    const detalle = await service.miTurno(31, '2026-09-14', actorAlumno)
    expect(detalle.asistencia).toEqual({
      estado: null,
      trabajado: null,
      indicaciones: null,
      cerradaPorSistema: true,
    })
    expect(detalle.horasSeguidas).toBeNull()
  })

  it('el turno de otro alumno → 403, sin leer el motor', async () => {
    repos.repository.buscarDatosAdicionales.mockResolvedValue({
      ...DATOS_ADICIONALES,
      alumnoId: 99,
    })

    const error = await errorDe(service.miTurno(31, AYER, actorAlumno))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error.code).toBe('SIN_PERMISO')
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('un turno inexistente → 404; una fecha que no es suya → el mismo 404', async () => {
    repos.repository.buscarDatosAdicionales.mockResolvedValue(null)
    expect(await errorDe(service.miTurno(31, AYER, actorAlumno))).toBeInstanceOf(NotFoundError)

    repos.repository.buscarDatosAdicionales.mockResolvedValue(DATOS_ADICIONALES)
    delDia(null)
    expect(await errorDe(service.miTurno(31, AYER, actorAlumno))).toBeInstanceOf(NotFoundError)
  })

  it('un actor sin alumno (otro rol) → 403, sin buscar el turno', async () => {
    const error = await errorDe(service.miTurno(31, AYER, actorMesa))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.buscarDatosAdicionales).not.toHaveBeenCalled()
  })

  it('la respuesta del portal no trae prioridad, observaciones, acciones, cancelable ni auditoría', async () => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue([deOcho(), deNueve()])
    const lista = await service.misTurnos({ desde: AYER, hasta: AYER }, actorAlumno)
    const detalle = await service.miTurno(31, AYER, actorAlumno)

    for (const respuesta of [...lista, detalle]) {
      for (const clave of [
        'prioridad',
        'observaciones',
        'acciones',
        'cancelable',
        'createdBy',
        'updatedBy',
      ]) {
        expect(respuesta).not.toHaveProperty(clave)
      }
      expect(respuesta).not.toHaveProperty('pago')
    }
    expect(detalle.asistencia).not.toHaveProperty('observacion')
    expect(detalle.asistencia).not.toHaveProperty('registradaPor')
    for (const hora of detalle.horasSeguidas?.ocurrencias ?? []) {
      expect(hora).not.toHaveProperty('registrable')
      expect(hora).not.toHaveProperty('observacion')
    }
  })
})

// ---------------------------------------------------------------------------------------------
// turnosDelAlumnoParaDocumento
// ---------------------------------------------------------------------------------------------

describe('turnosDelAlumnoParaDocumento', () => {
  const turnos = [
    ocurrencia({ turnoId: 1, fecha: '2026-09-21', estado: 'SIN_REGISTRAR' }),
    ocurrencia({ turnoId: 1, fecha: '2026-09-28' }),
    ocurrencia({ turnoId: 2, fecha: '2026-09-29', estado: 'CANCELADO' }),
  ]

  beforeEach(() => {
    repos.repository.leerOcurrenciasDelAlumno.mockResolvedValue(turnos)
    repos.alumnosRepository.buscarPorId.mockResolvedValue(ALUMNO)
  })

  it('sin filtros: el alumno, el rango por defecto (el año en curso) y los mismos turnos que el listado', async () => {
    const documento = await service.turnosDelAlumnoParaDocumento({ alumnoId: 12 })

    expect(documento).toEqual({
      alumno: { nombre: 'Lucía', apellido: 'González', dni: '40123456' },
      desde: '2026-01-01',
      hasta: '2026-12-31',
      porSeleccion: false,
      estado: null,
      turnos: await service.listarDelAlumno({ alumnoId: 12 }),
    })
    expect(documento.turnos).toHaveLength(3)
    expect(repos.alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
  })

  it('con un rango, lee ese rango y lo devuelve', async () => {
    const documento = await service.turnosDelAlumnoParaDocumento({
      alumnoId: 12,
      desde: '2026-09-01',
      hasta: '2026-09-30',
    })

    expect(repos.repository.leerOcurrenciasDelAlumno).toHaveBeenCalledWith(
      { desde: '2026-09-01', hasta: '2026-09-30', alumnoId: 12 },
      relojFijo,
    )
    expect(documento).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30' })
  })

  it('con `estado`, sólo los de ese estado', async () => {
    const documento = await service.turnosDelAlumnoParaDocumento({
      alumnoId: 12,
      estado: 'AGENDADO',
    })

    expect(documento.turnos.map((t) => [t.turnoId, t.fecha])).toEqual([[1, '2026-09-28']])
    expect(documento).toMatchObject({ porSeleccion: false, estado: 'AGENDADO' })
  })

  it('con `seleccion`, sólo esas y se ignora `estado`', async () => {
    const documento = await service.turnosDelAlumnoParaDocumento({
      alumnoId: 12,
      estado: 'AGENDADO',
      seleccion: ['2:2026-09-29', '1:2026-09-21', '9:2026-09-28'],
    })

    // En el orden del listado, no en el de la selección; la clave que no existe no agrega nada.
    expect(documento.turnos.map((t) => [t.turnoId, t.fecha])).toEqual([
      [1, '2026-09-21'],
      [2, '2026-09-29'],
    ])
    expect(documento).toMatchObject({ porSeleccion: true, estado: null })
  })

  it('un alumno inexistente → 404, sin leer sus turnos', async () => {
    repos.alumnosRepository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.turnosDelAlumnoParaDocumento({ alumnoId: 99 }))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.leerOcurrenciasDelAlumno).not.toHaveBeenCalled()
  })

  it('el rango se valida antes de buscar al alumno: fuera de la ventana → 400 en `hasta`', async () => {
    const error = await errorDe(
      service.turnosDelAlumnoParaDocumento({
        alumnoId: 12,
        desde: '2025-08-01',
        hasta: '2025-09-30',
      }),
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe(MENSAJE_FUERA_DE_VENTANA)
    expect(repos.alumnosRepository.buscarPorId).not.toHaveBeenCalled()
  })
})
