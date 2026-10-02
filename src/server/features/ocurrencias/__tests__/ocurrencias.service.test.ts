import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type {
  FilaDeSerie,
  Finalizacion,
  Ocurrencia,
  OcurrenciasRepository,
  PagoDeOcurrencia,
} from '../ocurrencias.repository'
import { MENSAJE_FUERA_DE_VENTANA, MENSAJE_RANGO_INVERTIDO } from '../ocurrencias.reglas'
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
  alumnoDni: '40123456',
  observaciones: null,
  temas: null,
  precioVigente: 8000,
  createdAt: '2026-08-01T13:00:00.000Z',
  updatedAt: '2026-08-01T13:00:00.000Z',
  createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
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

function crearRepositories() {
  return {
    repository: {
      buscarOcurrencia: vi.fn<OcurrenciasRepository['buscarOcurrencia']>(),
      buscarDatosAdicionales: vi.fn<OcurrenciasRepository['buscarDatosAdicionales']>(),
      leerFilasDeLaHora: vi.fn<OcurrenciasRepository['leerFilasDeLaHora']>(),
      buscarFinalizacion: vi.fn<OcurrenciasRepository['buscarFinalizacion']>(),
      buscarPago: vi.fn<OcurrenciasRepository['buscarPago']>(),
      leerOcurrenciasDelAlumno: vi.fn<OcurrenciasRepository['leerOcurrenciasDelAlumno']>(),
      resolverUsuarioAuditoria: vi.fn<OcurrenciasRepository['resolverUsuarioAuditoria']>(),
      leerPrioridades: vi.fn<OcurrenciasRepository['leerPrioridades']>(),
    },
    profesoresRepository: {
      buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>(),
    },
  }
}

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
// obtenerDetalle
// ---------------------------------------------------------------------------------------------

describe('obtenerDetalle', () => {
  it('el turno no existe, o la fecha no es una de sus ocurrencias → 404', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorMesa))
    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('una fecha posterior al fin efectivo de una serie finalizada no es una ocurrencia → 404', async () => {
    // El motor de T-30 (`leerOcurrencias`) ya no la genera: el repository devuelve `null`.
    repos.repository.buscarOcurrencia.mockResolvedValue(null)

    const error = await errorDe(service.obtenerDetalle(31, '2026-12-01', actorMesa))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(repos.repository.buscarDatosAdicionales).not.toHaveBeenCalled()
  })

  it('profesor ajeno al turno → 403, sin pedir el detalle ni las acciones', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

    const error = await errorDe(service.obtenerDetalle(31, HOY, actorProfesorAjeno))
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(repos.repository.buscarDatosAdicionales).not.toHaveBeenCalled()
  })

  it('profesor dueño del turno: ve el detalle, pero con las cuatro acciones en `false` (el profesor no opera en este incremento)', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorProfesorDueño)
    expect(detalle.turnoId).toBe(31)
    expect(detalle.acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
    })
  })

  it('profesor dueño del turno: no ve el pago (`pago: null`), ni pendiente ni pagado, y no se consulta', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))
    expect((await service.obtenerDetalle(31, HOY, actorProfesorDueño)).pago).toBeNull()

    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: 8000 })
    expect(detalle.acciones.registrarPago).toEqual({ visible: true })
    expect(detalle.acciones.cancelar).toEqual({ visible: true, habilitada: true })
    expect(repos.repository.buscarPago).not.toHaveBeenCalled()
  })

  it('pendiente y la materia no tiene precio: `importeVigente: null`; el botón se ofrece igual (decide el 409 SIN_PRECIO)', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))
    repos.repository.buscarDatosAdicionales.mockResolvedValue({
      ...DATOS_ADICIONALES,
      precioVigente: null,
    })

    const detalle = await service.obtenerDetalle(31, HOY, actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: null })
    expect(detalle.acciones.registrarPago).toEqual({ visible: true })
  })

  it('pendiente y posterior al tope de cobro (hoy + 56): no se ofrece registrar el pago', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(
      ocurrencia({ turnoId: 31, fecha: '2026-11-18' }),
    )

    const detalle = await service.obtenerDetalle(31, '2026-11-18', actorMesa)
    expect(detalle.pago).toEqual({ estado: 'PENDIENTE', importeVigente: 8000 })
    expect(detalle.acciones.registrarPago).toEqual({ visible: false })
  })

  it('pagada: `pago` con los datos de su pago, cancelar deshabilitada con su motivo y sin registrarPago', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

    await service.obtenerDetalle(31, HOY, actorMesa)
    expect(repos.profesoresRepository.buscarIdPorUsuario).not.toHaveBeenCalled()
  })

  it('arma el DTO campo por campo: DNI del alumno, horas en HH:mm, sin `busqueda`', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

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
    expect(detalle.createdBy).toEqual({ id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' })
    expect(JSON.stringify(detalle)).not.toContain('busqueda')
  })

  it('sesión única: no pide las filas de la hora ni la finalización (no aplica)', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(
      ocurrencia({ turnoId: 31, fecha: HOY, tipo: 'SESION_UNICA' }),
    )

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
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))

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
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))
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
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    repos.repository.buscarOcurrencia.mockResolvedValue(
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
    })
  })

  it('no cancelada: pide la prioridad y la incluye con el examen que la determina', async () => {
    repos.repository.buscarOcurrencia.mockResolvedValue(ocurrencia({ turnoId: 31, fecha: HOY }))
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
    repos.repository.buscarOcurrencia.mockResolvedValue(
      ocurrencia({ turnoId: 31, fecha: '2026-09-01', estado: 'SIN_REGISTRAR' }),
    )

    const detalle = await service.obtenerDetalle(31, '2026-09-01', actorMesa)
    expect(detalle.acciones.cancelar).toEqual({ visible: false, habilitada: false })
    expect(detalle.acciones.reprogramar).toEqual({ visible: false })
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
    })
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
