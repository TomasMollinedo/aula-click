import { AppError, ForbiddenError, NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import { alumnoDeLaSesion, type Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { TurnosDelAlumnoDocumento } from './ocurrencias.documentos'
import type {
  DatosAdicionalesTurno,
  Ocurrencia,
  OcurrenciasRepository,
  PrioridadDeTurno,
} from './ocurrencias.repository'
import {
  ACCIONES_SIN_PERMISO,
  asistenciaDelDetalle,
  asistenciaDelPortal,
  calcularAcciones,
  filtrarParaDocumento,
  horasSeguidasDelDetalle,
  horasSeguidasDelPortal,
  puedeRegistrarAsistencia,
  usuariosDeLaAsistencia,
  validarRangoMisTurnos,
  validarRangoOcurrencias,
  ventanaOcurrencias,
} from './ocurrencias.reglas'
import type {
  MiTurnoDetalle,
  MiTurnoItem,
  MisTurnos,
  MisTurnosQuery,
  OcurrenciaDelAlumnoItem,
  OcurrenciaDetalle,
  OcurrenciasDelAlumnoListado,
  OcurrenciasDelAlumnoQuery,
  TurnosDelAlumnoPdfQuery,
} from './ocurrencias.validation'

// Reglas de `ocurrencias`. No conoce HTTP ni Prisma: lanza AppError o sus subclases. La expansión,
// el pago y la prioridad salen del motor de otras features (vía el repository); acá sólo se arma el
// DTO y se calculan las acciones permitidas y la forma de la asistencia (`ocurrencias.reglas.ts`).

const MENSAJE_NO_ENCONTRADA = 'No existe una ocurrencia con ese turno y esa fecha'
const MENSAJE_SIN_PERMISO = 'El turno no es suyo'
const MENSAJE_PAGO_INCONSISTENTE = 'La ocurrencia figura pagada, pero no se encontró su pago'
const MENSAJE_ALUMNO_NO_ENCONTRADO = 'Alumno no encontrado'

/** El plazo de asistencia del motor, copiado campo por campo para el DTO. */
function plazoAsistencia(ocurrencia: Ocurrencia): OcurrenciaDetalle['plazoAsistencia'] {
  const plazo = ocurrencia.plazoAsistencia
  return plazo && { vence: plazo.vence, vencido: plazo.vencido }
}

/** Clave de `leerPrioridades`: la misma que arma `clavePrioridad` en `examenes.condiciones.ts`. */
function clavePrioridad(item: { alumnoId: number; materiaId: number; fecha: string }): string {
  return `${item.alumnoId}-${item.materiaId}-${item.fecha}`
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo. Los importa solo como tipo, así el service no
 * carga Prisma ni `@/config/env`.
 */
export function crearOcurrenciasService({
  repository,
  profesoresRepository,
  alumnosRepository,
  reloj,
}: {
  repository: OcurrenciasRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /**
   * El `pago` del detalle (HU-15). Pendiente: el precio vigente de la materia, que es lo que se
   * cobraría hoy (`null` sin precio). Pagada: el importe que se cobró (`importeAplicado`, del motor:
   * no cambia si después cambia el precio) y los datos de su pago, en una consulta.
   */
  async function armarPago(
    ocurrencia: Ocurrencia,
    precioVigente: number | null,
  ): Promise<NonNullable<OcurrenciaDetalle['pago']>> {
    const { estado, pagoId, importeAplicado } = ocurrencia.pago
    if (estado === 'PENDIENTE') return { estado, importeVigente: precioVigente }

    // No puede faltar: el motor marca `PAGADO` porque existe el `PagoTurno` de ese pago.
    const pago = pagoId === undefined ? null : await repository.buscarPago(pagoId)
    if (!pago || pagoId === undefined || importeAplicado === undefined) {
      throw new AppError(MENSAJE_PAGO_INCONSISTENTE, 500)
    }
    return { estado, pagoId, importe: importeAplicado, ...pago }
  }

  /** Lo del turno que no trae el motor, con su alumno; 404 si el turno no existe. */
  async function buscarTurno(turnoId: number): Promise<DatosAdicionalesTurno> {
    const datos = await repository.buscarDatosAdicionales(turnoId)
    if (!datos) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)
    return datos
  }

  /**
   * La lectura del detalle (del personal y del portal): **una sola** llamada al motor, las
   * ocurrencias del alumno del turno en esa fecha. De ahí salen la pedida y sus horas seguidas. Si
   * la fecha no es una de las ocurrencias del turno, el mismo 404 que un turno inexistente.
   */
  async function leerDelDia(
    turnoId: number,
    fecha: string,
    alumnoId: number,
  ): Promise<{ ocurrencia: Ocurrencia; ocurrenciasDelDia: Ocurrencia[] }> {
    const ocurrenciasDelDia = await repository.leerOcurrenciasDelAlumno(
      { desde: fecha, hasta: fecha, alumnoId },
      reloj,
    )
    const ocurrencia = ocurrenciasDelDia.find((o) => o.turnoId === turnoId)
    if (!ocurrencia) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)
    return { ocurrencia, ocurrenciasDelDia }
  }

  /**
   * Detalle de una ocurrencia (HU-02, HU-13 a HU-20): combina la ocurrencia calculada por el
   * motor (estado, pago, cancelación, fin efectivo), lo que le falta del turno (DNI, observaciones,
   * temas, auditoría), la finalización de su hora si la tiene y su prioridad.
   *
   * En un recurrente, "Finalizar" y `serie.finalizacion` se resuelven sobre las filas de su serie
   * que son de la misma hora (todos sus tramos, decisiones T-103 y T-104): la finalización puede
   * estar registrada en otro tramo de esa hora.
   *
   * Una sola lectura del motor: las ocurrencias del alumno del turno en esa fecha, de donde salen la
   * pedida y sus horas seguidas (`horasSeguidasDelDetalle`). El turno se busca antes (404 si no
   * existe) y la fecha tiene que ser una de sus ocurrencias (si no, el mismo 404).
   *
   * `PROFESOR` ve el turno sin operar ni cobrar: las acciones en `false` y `pago: null`. El del turno
   * suma `registrarAsistencia` (y las horas `registrable`) mientras el plazo esté abierto. Uno ajeno
   * lo ve en sólo lectura si el alumno tiene o tuvo turnos con él (HU-31, desde el historial); si no,
   * 403. No se filtra antes: primero hay que saber de quién es el turno, y eso ya resuelve el 404.
   * `MESA_ENTRADAS` no tiene esta restricción.
   */
  async function obtenerDetalle(
    turnoId: number,
    fecha: string,
    actor: Actor,
  ): Promise<OcurrenciaDetalle> {
    const datos = await buscarTurno(turnoId)
    const { ocurrencia, ocurrenciasDelDia } = await leerDelDia(turnoId, fecha, datos.alumnoId)

    const esProfesor = actor.role === 'PROFESOR'
    let esProfesorDelTurno = false
    if (esProfesor) {
      const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
      esProfesorDelTurno = profesorId !== null && profesorId === ocurrencia.profesorId
      const conRelacion =
        esProfesorDelTurno ||
        (profesorId !== null &&
          (await repository.profesorTieneAlumno(profesorId, ocurrencia.alumnoId)))
      if (!conRelacion) throw new ForbiddenError(MENSAJE_SIN_PERMISO)
    }

    const filasDeLaHora =
      ocurrencia.tipo === 'RECURRENTE' ? await repository.leerFilasDeLaHora(turnoId) : []
    const finalizadas = filasDeLaHora.filter((fila) => fila.finalizadaDesde !== null)
    // Si el propio turno tiene finalización, es la suya; si no, la de otro tramo de su hora.
    const propia = finalizadas.filter((fila) => fila.turnoId === turnoId)
    const finalizacion =
      finalizadas.length > 0
        ? await repository.buscarFinalizacion(
            (propia.length > 0 ? propia : finalizadas).map((fila) => fila.turnoId),
          )
        : null

    // El motor de T-30 solo trae el id de quién canceló (a diferencia de `alumno`/`profesor`, que
    // ya vienen resueltos): se busca el usuario acá, la única vez que hace falta.
    const cancelacion = ocurrencia.cancelacion && {
      motivo: ocurrencia.cancelacion.motivo,
      detalle: ocurrencia.cancelacion.detalle,
      createdAt: ocurrencia.cancelacion.createdAt,
      createdBy: await repository.resolverUsuarioAuditoria(ocurrencia.cancelacion.createdById),
    }

    const fechaHoy = hoy(reloj)
    const prioridadPorClave =
      ocurrencia.estado === 'CANCELADO'
        ? null
        : ((
            await repository.leerPrioridades([
              { alumnoId: ocurrencia.alumnoId, materiaId: ocurrencia.materiaId, fecha },
            ])
          ).get(
            clavePrioridad({
              alumnoId: ocurrencia.alumnoId,
              materiaId: ocurrencia.materiaId,
              fecha,
            }),
          ) ?? null)

    // Sólo el profesor del turno registra (o corrige) la asistencia, y sólo con el plazo abierto.
    const puedeRegistrar = esProfesorDelTurno && puedeRegistrarAsistencia(ocurrencia)
    const acciones = esProfesor
      ? { ...ACCIONES_SIN_PERMISO, registrarAsistencia: { visible: puedeRegistrar } }
      : calcularAcciones(
          ocurrencia,
          filasDeLaHora.map((fila) => ({
            fechaFin: fila.fechaFin,
            finalizada: fila.finalizadaDesde !== null,
          })),
          fechaHoy,
        )
    const pago = esProfesor ? null : await armarPago(ocurrencia, datos.precioVigente)

    // El motor sólo trae los ids de quién registró y modificó la asistencia: se resuelven los dos
    // en una consulta, y sólo si hay una asistencia registrada que mostrar.
    const idsAsistencia = usuariosDeLaAsistencia(ocurrencia)
    const usuariosAsistencia =
      idsAsistencia.length > 0
        ? await repository.resolverUsuariosAuditoria(idsAsistencia)
        : new Map<string, never>()

    return {
      turnoId: ocurrencia.turnoId,
      fecha: ocurrencia.fecha,
      alumno: {
        id: ocurrencia.alumno.id,
        nombre: ocurrencia.alumno.nombre,
        apellido: ocurrencia.alumno.apellido,
        dni: datos.alumnoDni,
      },
      materia: ocurrencia.materia,
      profesor: {
        id: ocurrencia.profesor.id,
        nombre: ocurrencia.profesor.nombre,
        apellido: ocurrencia.profesor.apellido,
      },
      aula: ocurrencia.aula,
      horaInicio: minutosAHora(ocurrencia.horaInicio),
      horaFin: minutosAHora(ocurrencia.horaFin),
      tipo: ocurrencia.tipo,
      serie: {
        fechaInicio: ocurrencia.serie.fechaInicio,
        fechaFin: ocurrencia.serie.fechaFin,
        finalizacion,
      },
      estado: ocurrencia.estado,
      observaciones: datos.observaciones,
      temas: datos.temas,
      cancelacion: cancelacion ?? null,
      pago,
      prioridad: prioridadPorClave?.prioridad ?? null,
      examen: prioridadPorClave?.examen ?? null,
      plazoAsistencia: plazoAsistencia(ocurrencia),
      asistencia: asistenciaDelDetalle(ocurrencia, usuariosAsistencia),
      horasSeguidas: horasSeguidasDelDetalle(ocurrenciasDelDia, turnoId, puedeRegistrar),
      acciones,
      createdAt: datos.createdAt,
      updatedAt: datos.updatedAt,
      createdBy: datos.createdBy,
      updatedBy: datos.updatedBy,
    }
  }

  /**
   * Ítem de `GET /ocurrencias`, con el estado de pago (del motor, sin consultas), la prioridad y
   * `cancelable` (mismas reglas que `acciones.cancelar`: una pagada no se puede tildar).
   */
  function aItem(
    ocurrencia: Ocurrencia,
    fechaHoy: string,
    prioridad: PrioridadDeTurno['prioridad'] | null,
  ): OcurrenciaDelAlumnoItem {
    return {
      turnoId: ocurrencia.turnoId,
      fecha: ocurrencia.fecha,
      diaSemana: ocurrencia.diaSemana,
      horaInicio: minutosAHora(ocurrencia.horaInicio),
      horaFin: minutosAHora(ocurrencia.horaFin),
      profesor: {
        id: ocurrencia.profesor.id,
        nombre: ocurrencia.profesor.nombre,
        apellido: ocurrencia.profesor.apellido,
      },
      materia: ocurrencia.materia,
      tipo: ocurrencia.tipo,
      estado: ocurrencia.estado,
      estadoPago: ocurrencia.pago.estado,
      prioridad,
      // Sin las filas de la hora: acá sólo se usa `cancelar`, que no las mira.
      cancelable: calcularAcciones(ocurrencia, [], fechaHoy).cancelar.habilitada,
      plazoAsistencia: plazoAsistencia(ocurrencia),
    }
  }

  /** El rango de `GET /ocurrencias` y de su PDF: el pedido o la ventana por defecto, ya validado. */
  type Rango = { desde: string; hasta: string; fechaHoy: string }

  /**
   * Sin `desde`/`hasta`, la ventana por defecto de T-43/T-66 (el año en curso completo); un rango
   * explícito que se salga de esa ventana, o venga invertido, es 400 en `hasta`.
   */
  function resolverRango(query: Pick<OcurrenciasDelAlumnoQuery, 'desde' | 'hasta'>): Rango {
    const fechaHoy = hoy(reloj)
    const ventana = ventanaOcurrencias(fechaHoy)
    const desde = query.desde ?? ventana.desde
    const hasta = query.hasta ?? ventana.hasta
    validarRangoOcurrencias(desde, hasta, fechaHoy)
    return { desde, hasta, fechaHoy }
  }

  /**
   * Las ocurrencias del alumno en el rango, incluidas las canceladas, cada una con su prioridad y
   * si se puede cancelar. Lo que devuelve `GET /ocurrencias` y lo que lista su PDF.
   */
  async function leerDelAlumno(
    alumnoId: number,
    { desde, hasta, fechaHoy }: Rango,
  ): Promise<OcurrenciasDelAlumnoListado> {
    const ocurrencias = await repository.leerOcurrenciasDelAlumno({ desde, hasta, alumnoId }, reloj)
    const noCanceladas = ocurrencias.filter((o) => o.estado !== 'CANCELADO')
    const prioridades = await repository.leerPrioridades(
      noCanceladas.map((o) => ({ alumnoId: o.alumnoId, materiaId: o.materiaId, fecha: o.fecha })),
    )

    return ocurrencias.map((ocurrencia) => {
      const prioridad =
        ocurrencia.estado === 'CANCELADO'
          ? null
          : (prioridades.get(
              clavePrioridad({
                alumnoId: ocurrencia.alumnoId,
                materiaId: ocurrencia.materiaId,
                fecha: ocurrencia.fecha,
              }),
            )?.prioridad ?? null)
      return aItem(ocurrencia, fechaHoy, prioridad)
    })
  }

  /** Ítem de `GET /ocurrencias/mis-turnos`: sin prioridad, ocupación, `cancelable` ni auditoría. */
  function aMiTurno(ocurrencia: Ocurrencia): MiTurnoItem {
    return {
      turnoId: ocurrencia.turnoId,
      fecha: ocurrencia.fecha,
      diaSemana: ocurrencia.diaSemana,
      horaInicio: minutosAHora(ocurrencia.horaInicio),
      horaFin: minutosAHora(ocurrencia.horaFin),
      materia: ocurrencia.materia,
      profesor: {
        id: ocurrencia.profesor.id,
        nombre: ocurrencia.profesor.nombre,
        apellido: ocurrencia.profesor.apellido,
      },
      aula: ocurrencia.aula,
      tipo: ocurrencia.tipo,
      estado: ocurrencia.estado,
      estadoPago: ocurrencia.pago.estado,
    }
  }

  return {
    obtenerDetalle,

    /**
     * Portal (HU-30, "Mi calendario"): las ocurrencias del alumno de la sesión en `[desde, hasta]`
     * (hasta `MAX_DIAS_MIS_TURNOS` días; si no, o invertido, 400 en `hasta`), incluidas las
     * canceladas, en el orden del motor. El alumno sale de la sesión, nunca de un parámetro.
     */
    async misTurnos(query: MisTurnosQuery, actor: Actor): Promise<MisTurnos> {
      const alumnoId = alumnoDeLaSesion(actor)
      validarRangoMisTurnos(query.desde, query.hasta)
      const ocurrencias = await repository.leerOcurrenciasDelAlumno(
        { desde: query.desde, hasta: query.hasta, alumnoId },
        reloj,
      )
      return ocurrencias.map(aMiTurno)
    },

    /**
     * Portal (HU-30): el detalle de una ocurrencia del alumno de la sesión, con la misma lectura y
     * las mismas reglas que el del personal (`leerDelDia`, `asistenciaDelPortal` y
     * `horasSeguidasDelPortal`). Un turno de otro alumno → 403, sin leer el motor; uno que no
     * existe (o una fecha que no es suya) → 404. Sin prioridad, observaciones, acciones, datos del
     * pago ni auditoría.
     */
    async miTurno(turnoId: number, fecha: string, actor: Actor): Promise<MiTurnoDetalle> {
      const alumnoId = alumnoDeLaSesion(actor)
      const datos = await buscarTurno(turnoId)
      if (datos.alumnoId !== alumnoId) throw new ForbiddenError(MENSAJE_SIN_PERMISO)
      const { ocurrencia, ocurrenciasDelDia } = await leerDelDia(turnoId, fecha, alumnoId)

      return {
        turnoId: ocurrencia.turnoId,
        fecha: ocurrencia.fecha,
        horaInicio: minutosAHora(ocurrencia.horaInicio),
        horaFin: minutosAHora(ocurrencia.horaFin),
        materia: ocurrencia.materia,
        profesor: {
          id: ocurrencia.profesor.id,
          nombre: ocurrencia.profesor.nombre,
          apellido: ocurrencia.profesor.apellido,
        },
        aula: ocurrencia.aula,
        tipo: ocurrencia.tipo,
        temas: datos.temas,
        estado: ocurrencia.estado,
        plazoAsistencia: plazoAsistencia(ocurrencia),
        estadoPago: ocurrencia.pago.estado,
        asistencia: asistenciaDelPortal(ocurrencia),
        // El alumno nunca registra: ninguna hora es `registrable` (y el portal no la publica).
        horasSeguidas: horasSeguidasDelPortal(
          horasSeguidasDelDetalle(ocurrenciasDelDia, turnoId, false),
        ),
      }
    },

    /**
     * Ocurrencias del alumno en `[desde, hasta]` (HU-02, pestaña "Turnos" de la ficha), incluidas
     * las canceladas: cada una con su prioridad y si se puede cancelar. Sin `desde`/`hasta`, la
     * ventana por defecto de T-43/T-66 (el año en curso completo); un rango explícito que se salga
     * de esa ventana, o venga invertido, es 400 en `hasta`.
     */
    async listarDelAlumno(query: OcurrenciasDelAlumnoQuery): Promise<OcurrenciasDelAlumnoListado> {
      return leerDelAlumno(query.alumnoId, resolverRango(query))
    },

    /**
     * Lo que va en el PDF de los turnos de un alumno: los mismos turnos y el mismo rango que
     * `listarDelAlumno`, filtrados por la selección o el estado (`filtrarParaDocumento`), más el
     * alumno para el encabezado. A diferencia del listado, un alumno inexistente es 404: sin su
     * nombre y su DNI no hay documento. El rango se valida antes (400).
     */
    async turnosDelAlumnoParaDocumento(
      query: TurnosDelAlumnoPdfQuery,
    ): Promise<TurnosDelAlumnoDocumento> {
      const rango = resolverRango(query)
      const alumno = await alumnosRepository.buscarPorId(query.alumnoId)
      if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)

      const turnos = filtrarParaDocumento(await leerDelAlumno(query.alumnoId, rango), query)
      return {
        alumno: { nombre: alumno.nombre, apellido: alumno.apellido, dni: alumno.dni },
        desde: rango.desde,
        hasta: rango.hasta,
        porSeleccion: query.seleccion !== undefined,
        estado: query.seleccion === undefined ? (query.estado ?? null) : null,
        turnos,
      }
    },
  }
}

export type OcurrenciasService = ReturnType<typeof crearOcurrenciasService>
