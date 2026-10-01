import { AppError, ForbiddenError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { Ocurrencia, OcurrenciasRepository, PrioridadDeTurno } from './ocurrencias.repository'
import {
  ACCIONES_SIN_PERMISO,
  calcularAcciones,
  validarRangoOcurrencias,
  ventanaOcurrencias,
} from './ocurrencias.reglas'
import type {
  OcurrenciaDelAlumnoItem,
  OcurrenciaDetalle,
  OcurrenciasDelAlumnoListado,
  OcurrenciasDelAlumnoQuery,
} from './ocurrencias.validation'

// Reglas de `ocurrencias`. No conoce HTTP ni Prisma: lanza AppError o sus subclases. La expansión,
// el pago y la prioridad salen del motor de otras features (vía el repository); acá sólo se arma el
// DTO y se calculan las acciones permitidas (`ocurrencias.reglas.ts`).

const MENSAJE_NO_ENCONTRADA = 'No existe una ocurrencia con ese turno y esa fecha'
const MENSAJE_SIN_PERMISO = 'El turno no es suyo'
const MENSAJE_PAGO_INCONSISTENTE = 'La ocurrencia figura pagada, pero no se encontró su pago'

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
  reloj,
}: {
  repository: OcurrenciasRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
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

  /**
   * Detalle de una ocurrencia (HU-02, HU-13 a HU-20): combina la ocurrencia calculada por el
   * motor (estado, pago, cancelación, fin efectivo), lo que le falta del turno (DNI, observaciones,
   * temas, auditoría), su finalización si la tiene y su prioridad.
   *
   * `PROFESOR` sólo puede ver el turno si es suyo (si no, 403; no se filtra antes: primero hay que
   * saber de quién es el turno, y eso ya resuelve el 404). Ve el turno sin operar ni cobrar: las
   * cuatro acciones en `false` y `pago: null`. `MESA_ENTRADAS` no tiene esta restricción.
   */
  async function obtenerDetalle(
    turnoId: number,
    fecha: string,
    actor: Actor,
  ): Promise<OcurrenciaDetalle> {
    const ocurrencia = await repository.buscarOcurrencia(turnoId, fecha, reloj)
    if (!ocurrencia) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)

    if (actor.role === 'PROFESOR') {
      const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
      if (profesorId !== ocurrencia.profesorId) throw new ForbiddenError(MENSAJE_SIN_PERMISO)
    }

    // No puede faltar: `buscarOcurrencia` ya confirmó que el turno existe.
    const datos = await repository.buscarDatosAdicionales(turnoId)
    if (!datos) throw new NotFoundError(MENSAJE_NO_ENCONTRADA)

    const finalizacion =
      ocurrencia.tipo === 'RECURRENTE' ? await repository.buscarFinalizacion(turnoId) : null

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

    const esProfesor = actor.role === 'PROFESOR'
    const acciones = esProfesor ? ACCIONES_SIN_PERMISO : calcularAcciones(ocurrencia, fechaHoy)
    const pago = esProfesor ? null : await armarPago(ocurrencia, datos.precioVigente)

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
      cancelable: calcularAcciones(ocurrencia, fechaHoy).cancelar.habilitada,
    }
  }

  return {
    obtenerDetalle,

    /**
     * Ocurrencias del alumno en `[desde, hasta]` (HU-02, pestaña "Turnos" de la ficha), incluidas
     * las canceladas: cada una con su prioridad y si se puede cancelar. Sin `desde`/`hasta`, la
     * ventana por defecto de T-43 (30 días atrás a 8 semanas adelante); un rango explícito que se
     * salga de esa ventana, o venga invertido, es 400 en `hasta`.
     */
    async listarDelAlumno(query: OcurrenciasDelAlumnoQuery): Promise<OcurrenciasDelAlumnoListado> {
      const fechaHoy = hoy(reloj)
      const ventana = ventanaOcurrencias(fechaHoy)
      const desde = query.desde ?? ventana.desde
      const hasta = query.hasta ?? ventana.hasta
      validarRangoOcurrencias(desde, hasta, fechaHoy)

      const ocurrencias = await repository.leerOcurrenciasDelAlumno(
        { desde, hasta, alumnoId: query.alumnoId },
        reloj,
      )
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
    },
  }
}

export type OcurrenciasService = ReturnType<typeof crearOcurrenciasService>
