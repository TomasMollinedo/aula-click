import { randomUUID } from 'node:crypto'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import { alumnoDeLaSesion, type Actor } from '@/server/shared/actor'
import {
  diaSemanaISO,
  hoy,
  proximaFechaDelDia,
  sumarDias,
  type Reloj,
} from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import {
  disponibilidadParaElAlumno,
  errorParaElAlumno,
  MENSAJE_DESDE_MANANA,
  resumenParaElAlumno,
} from './mis-turnos.reglas'
import {
  MENSAJE_DEUDA_VENCIDA_PORTAL,
  mensajeDeudaVencidaMesa,
  verificarTopeDeuda,
} from './tope-deuda.reglas'
import type { TurnosRepository } from './turnos.repository'
import {
  CODIGO_MATERIA_INACTIVA,
  MENSAJE_FECHA_PASADA,
  MENSAJE_MATERIA_INACTIVA,
  MENSAJE_MATERIA_NO_ENCONTRADA,
  nombreDia,
  planificarReserva,
  validarFechasEnDia,
  validarFilas,
  validarMateria,
  validarProfesor,
  type PedidoReserva,
} from './turnos.reglas'
import type {
  CrearMiTurno,
  CrearTurno,
  DeudaVencida,
  DisponibilidadItem,
  DisponibilidadQuery,
  Habilitacion,
  MateriaOfertada,
  MiDisponibilidadItem,
  TurnoDetalle,
  TurnoReservado,
  TurnosAlta,
} from './turnos.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. El cálculo de
// fechas y capacidad está en `turnos.reglas.ts` (puro); de alumnos, bloques, profesores y materias
// solo lee, por sus repositories.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 * `generarSerieId` (por defecto `randomUUID`) da el id de la serie de cada alta (decisión T-103).
 */
export function crearTurnosService({
  repository,
  alumnosRepository,
  bloquesRepository,
  profesoresRepository,
  materiasRepository,
  reloj,
  generarSerieId = randomUUID,
}: {
  repository: Pick<
    TurnosRepository,
    | 'contarOcupacionPorBloque'
    | 'reservar'
    | 'buscarDetalle'
    | 'deudaVencidaDe'
    | 'listarMateriasOfertadas'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  bloquesRepository: Pick<BloquesRepository, 'buscarPorIds' | 'listarActivasDeProfesores'>
  profesoresRepository: Pick<
    ProfesoresRepository,
    'listarProfesoresActivosDeMateria' | 'buscarConAsignaciones'
  >
  materiasRepository: Pick<MateriasRepository, 'buscarPorIds' | 'buscarPorId'>
  reloj?: Reloj
  generarSerieId?: () => string
}) {
  /**
   * Desde qué fecha se puede sacar un turno: la mesa, desde hoy (aunque la hora ya haya pasado);
   * el alumno, desde mañana (HU-29). Cada camino con su mensaje para una fecha anterior.
   */
  type Desde = { fecha: string; mensaje: string }
  const desdeMesa = (): Desde => ({ fecha: hoy(reloj), mensaje: MENSAJE_FECHA_PASADA })
  const desdePortal = (): Desde => ({
    fecha: sumarDias(hoy(reloj), 1),
    mensaje: MENSAJE_DESDE_MANANA,
  })

  /** 400 en `campo` si `fecha` es anterior a `desde`. */
  function exigirDesde(fecha: string, desde: Desde, campo: string): void {
    if (fecha < desde.fecha) {
      throw new ValidationError(desde.mensaje, {
        details: [{ path: [campo], message: desde.mensaje }],
      })
    }
  }

  /**
   * Horas en las que se puede buscar un turno para una materia (HU-07): la **única** búsqueda, la
   * de la mesa (`disponibilidad`) y la del portal (`miDisponibilidad`, que oculta los cupos). Las
   * filas activas de los profesores activos que la dictan, agrupadas como las muestra la UI (mismo
   * profesor, día y aula, horas contiguas), cada hora con su capacidad efectiva y su ocupación.
   *
   * - Con `fecha`: la ocupación es la de esa fecha y el día sale de ella (400 si es anterior a
   *   `desde` o si contradice a `diaSemana`). Sin `fecha`: la próxima ocurrencia de cada día desde
   *   `desde` (en la mesa, hoy incluido, como el horario de bloques, T-33; en el portal, mañana).
   * - Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA` (sin `details`).
   * - Un `profesorId` que no dicta la materia no es error: `[]`.
   * - Las horas llenas vienen igual (`lleno`). Si un recurrente entra en todas sus fechas lo
   *   decide el alta, no esta lectura.
   * - Orden: el de los profesores (apellido y nombre), después día y hora.
   */
  async function buscarDisponibilidad(
    query: DisponibilidadQuery,
    desde: Desde,
  ): Promise<DisponibilidadItem[]> {
    let diaSemana = query.diaSemana
    if (query.fecha !== undefined) {
      exigirDesde(query.fecha, desde, 'fecha')
      const diaDeFecha = diaSemanaISO(query.fecha)
      if (diaSemana !== undefined && diaSemana !== diaDeFecha) {
        const mensaje = `La fecha debe caer en ${nombreDia(diaSemana)}`
        throw new ValidationError(mensaje, { details: [{ path: ['fecha'], message: mensaje }] })
      }
      diaSemana = diaDeFecha
    }

    const [materia] = await materiasRepository.buscarPorIds([query.materiaId])
    if (!materia) throw new NotFoundError(MENSAJE_MATERIA_NO_ENCONTRADA)
    if (materia.estado !== 'ACTIVO') {
      throw new ConflictError(MENSAJE_MATERIA_INACTIVA, { code: CODIGO_MATERIA_INACTIVA })
    }

    const profesores = (
      await profesoresRepository.listarProfesoresActivosDeMateria(query.materiaId)
    ).filter((profesor) => query.profesorId === undefined || profesor.id === query.profesorId)
    if (profesores.length === 0) return []
    const orden = new Map(profesores.map((profesor, i) => [profesor.id, i]))
    const porId = new Map(profesores.map((profesor) => [profesor.id, profesor]))

    const filas = await bloquesRepository.listarActivasDeProfesores({
      profesorIds: profesores.map((profesor) => profesor.id),
      diaSemana,
    })
    const fechaDe = (dia: number) => query.fecha ?? proximaFechaDelDia(dia, desde.fecha)
    // La ocupación sale del motor (`ocupacionesEn`, vía el repository): una sola consulta.
    const ocupacion = new Map(
      (
        await repository.contarOcupacionPorBloque(
          filas.map((fila) => ({ bloqueAgendaId: fila.id, fecha: fechaDe(fila.diaSemana) })),
        )
      ).map((grupo) => [grupo.bloqueAgendaId, grupo.cantidad]),
    )

    const ordenadas = [...filas].sort(
      (a, b) =>
        (orden.get(a.profesorId) ?? 0) - (orden.get(b.profesorId) ?? 0) ||
        a.diaSemana - b.diaSemana ||
        a.horaInicio - b.horaInicio ||
        a.id - b.id,
    )

    // Mismo criterio que `agruparHorario` del frontend: mismo profesor, día y aula, y el fin de
    // una hora es el inicio de la siguiente.
    const grupos: { item: DisponibilidadItem; profesorId: number; finMinutos: number }[] = []
    for (const fila of ordenadas) {
      const capacidadEfectiva = Math.min(fila.profesorCapacidad, fila.aula.capacidad)
      const ocupadas = ocupacion.get(fila.id) ?? 0
      const hora = {
        bloqueId: fila.id,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        capacidadEfectiva,
        ocupacion: ocupadas,
        lleno: ocupadas >= capacidadEfectiva,
      }
      const ultimo = grupos.at(-1)
      if (
        ultimo &&
        ultimo.profesorId === fila.profesorId &&
        ultimo.item.diaSemana === fila.diaSemana &&
        ultimo.item.aula.id === fila.aula.id &&
        ultimo.finMinutos === fila.horaInicio
      ) {
        ultimo.item.horas.push(hora)
        ultimo.item.horaFin = hora.horaFin
        ultimo.finMinutos = fila.horaFin
        continue
      }
      const profesor = porId.get(fila.profesorId)
      grupos.push({
        profesorId: fila.profesorId,
        finMinutos: fila.horaFin,
        item: {
          profesor: {
            id: fila.profesorId,
            nombre: profesor?.nombre ?? '',
            apellido: profesor?.apellido ?? '',
          },
          diaSemana: fila.diaSemana,
          fecha: fechaDe(fila.diaSemana),
          aula: { id: fila.aula.id, nombre: fila.aula.nombre },
          horaInicio: hora.horaInicio,
          horaFin: hora.horaFin,
          horas: [hora],
        },
      })
    }
    return grupos.map((grupo) => grupo.item)
  }

  /**
   * El alta (HU-08), la **única**: la de la mesa (`crear`) y la del portal (`crearMiTurno`). Una
   * fila `turno` por hora elegida (y por tramo, si un recurrente se crea solo donde hay lugar),
   * todo o nada. Chequeos, en orden, antes de la transacción (lecturas sin lock, para dar errores
   * claros):
   * 1. `fechaInicio` anterior a `desde` (hoy en la mesa, mañana en el portal) → 400.
   * 2. Alumno inexistente → 404.
   * 3. Filas inexistentes o inactivas → 404 por posición; de más de un profesor o día → 400.
   * 4. Fechas que no caen en el día de las filas → 400 en el campo.
   * 5. Profesor inactivo → 409 `PROFESOR_INACTIVO`.
   * 6. Materia inexistente (404), inactiva (409 `MATERIA_INACTIVA`) o no asignada al profesor
   *    (409 `MATERIA_NO_ASIGNADA`).
   * 7. `repository.reservar`, que bloquea (también al alumno), relee y decide: primero el tope de
   *    deuda (409 `DEUDA_VENCIDA` con `{ cantidad, total }`, con la deuda vencida leída bajo lock,
   *    HU-29) y después `planificarReserva`: lo anterior otra vez, `ALUMNO_SUPERPUESTO` y
   *    `BLOQUE_LLENO`.
   */
  async function reservarTurnos(
    datos: CrearMiTurno & { alumnoId: number; observaciones?: string | null },
    actor: Actor,
    { desde, mensajeDeuda }: { desde: Desde; mensajeDeuda: (deuda: DeudaVencida) => string },
  ): Promise<TurnosAlta> {
    exigirDesde(datos.fechaInicio, desde, 'fechaInicio')
    // En una sesión única se guarda siempre `fechaFin = fechaInicio` (T-20).
    const fechaFin = datos.tipo === 'SESION_UNICA' ? datos.fechaInicio : (datos.fechaFin ?? null)

    // No se valida el estado del alumno: su baja no está implementada (dominio.md → Alumnos).
    const alumno = await alumnosRepository.buscarPorId(datos.alumnoId)
    if (!alumno) throw new NotFoundError('Alumno no encontrado')

    const filas = await bloquesRepository.buscarPorIds(datos.bloqueIds)
    const { profesorId, diaSemana } = validarFilas(datos.bloqueIds, filas)
    validarFechasEnDia(diaSemana, datos.fechaInicio, fechaFin)

    const profesor = await profesoresRepository.buscarConAsignaciones(profesorId, [datos.materiaId])
    validarProfesor(profesor)
    const [materia] = await materiasRepository.buscarPorIds([datos.materiaId])
    validarMateria(
      materia ?? null,
      profesor?.asignaciones.find((asignacion) => asignacion.materiaId === datos.materiaId) ?? null,
    )

    const pedido: PedidoReserva = {
      alumnoId: datos.alumnoId,
      materiaId: datos.materiaId,
      profesorId,
      diaSemana,
      bloqueIds: datos.bloqueIds,
      tipo: datos.tipo,
      fechaInicio: datos.fechaInicio,
      fechaFin,
      observaciones: datos.observaciones ?? null,
      temas: datos.temas ?? null,
      asignarDondeHayLugar: datos.asignarDondeHayLugar,
      serieId: generarSerieId(),
    }
    const { turnos, fechasSinTurno } = await repository.reservar(
      {
        hoy: hoy(reloj),
        alumnoId: datos.alumnoId,
        profesorId,
        materiaId: datos.materiaId,
        bloqueIds: datos.bloqueIds,
        fechaInicio: datos.fechaInicio,
        fechaFin,
      },
      (snapshot) => {
        verificarTopeDeuda(snapshot.deudaVencida, mensajeDeuda(snapshot.deudaVencida))
        return planificarReserva(snapshot, pedido)
      },
      actor,
    )
    return { cantidad: turnos.length, turnos, fechasSinTurno }
  }

  return {
    /** Disponibilidad para la mesa de entrada, desde hoy. Ver `buscarDisponibilidad`. */
    async disponibilidad(query: DisponibilidadQuery): Promise<DisponibilidadItem[]> {
      return buscarDisponibilidad(query, desdeMesa())
    },

    /**
     * Registra un turno (HU-07) desde la mesa de entrada: desde hoy, con el tope de deuda (HU-29)
     * y el mensaje para la mesa, con la cantidad y el total. Ver `reservarTurnos`.
     */
    async crear(datos: CrearTurno, actor: Actor): Promise<TurnosAlta> {
      return reservarTurnos(datos, actor, {
        desde: desdeMesa(),
        mensajeDeuda: mensajeDeudaVencidaMesa,
      })
    },

    // -------------------------------------------------------------------------------------------
    // Portal del alumno (HU-29). El alumno sale de la sesión (`alumnoDeLaSesion`: 403 si el actor
    // no tiene alumno). Ningún método recibe un `alumnoId`.
    // -------------------------------------------------------------------------------------------

    /**
     * Si el alumno de la sesión puede sacar un turno nuevo, para avisarle antes del paso 1: no, si
     * tiene deuda vencida (`deudaVencida` de `cuentas`, T-76). Es sólo el aviso: el alta lo vuelve
     * a decidir bajo lock.
     */
    async habilitacion(actor: Actor): Promise<Habilitacion> {
      const alumnoId = alumnoDeLaSesion(actor)
      const deuda = await repository.deudaVencidaDe(alumnoId, hoy(reloj))
      return deuda.cantidad === 0 ? { habilitado: true, deuda: null } : { habilitado: false, deuda }
    },

    /**
     * Materias del paso 1: activas, con al menos un profesor activo que la tenga asignada (con
     * asignación activa) y tenga bloques activos. Por nombre.
     */
    async misMaterias(actor: Actor): Promise<MateriaOfertada[]> {
      alumnoDeLaSesion(actor)
      return repository.listarMateriasOfertadas()
    },

    /**
     * La disponibilidad de la mesa (la misma búsqueda, `buscarDisponibilidad`), desde mañana y
     * como la ve el alumno: cada hora `disponible` o no, sin cupos ni ocupación, con el valor por
     * clase (el precio por hora vigente de la materia, HU-12).
     */
    async miDisponibilidad(
      query: DisponibilidadQuery,
      actor: Actor,
    ): Promise<MiDisponibilidadItem[]> {
      alumnoDeLaSesion(actor)
      const items = await buscarDisponibilidad(query, desdePortal())
      if (items.length === 0) return []
      const materia = await materiasRepository.buscarPorId(query.materiaId)
      return disponibilidadParaElAlumno(items, materia?.precioHora ?? null)
    },

    /**
     * Saca un turno para el alumno de la sesión (HU-29): las mismas reglas que la mesa
     * (`reservarTurnos`), con las fechas desde mañana, el tope de deuda con el mensaje para el
     * alumno y "Ya tenés un turno ese día en ese horario". Queda `ACTIVO` ("Agendado") sin
     * aprobación, con la auditoría del usuario del alumno. Responde el resumen de "Turno
     * reservado", sin observaciones, auditoría ni cupos.
     */
    async crearMiTurno(datos: CrearMiTurno, actor: Actor): Promise<TurnoReservado> {
      const alumnoId = alumnoDeLaSesion(actor)
      try {
        const alta = await reservarTurnos({ ...datos, alumnoId }, actor, {
          desde: desdePortal(),
          mensajeDeuda: () => MENSAJE_DEUDA_VENCIDA_PORTAL,
        })
        return resumenParaElAlumno(alta)
      } catch (error) {
        throw errorParaElAlumno(error)
      }
    },

    /** Detalle de un turno, en cualquier estado. 404 si no existe. */
    async obtener(id: number): Promise<TurnoDetalle> {
      const turno = await repository.buscarDetalle(id)
      if (!turno) throw new NotFoundError('Turno no encontrado')
      return turno
    },
  }
}

export type TurnosService = ReturnType<typeof crearTurnosService>
