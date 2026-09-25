import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { terminosDeBusqueda } from '@/server/shared/busqueda'
import { diaSemanaISO, hoy, proximaFechaDelDia, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { TurnosRepository } from './turnos.repository'
import {
  CODIGO_MATERIA_INACTIVA,
  expandirOcurrencias,
  MENSAJE_FECHA_PASADA,
  MENSAJE_MATERIA_INACTIVA,
  MENSAJE_MATERIA_NO_ENCONTRADA,
  nombreDia,
  planificarReserva,
  validarFechasEnDia,
  validarFilas,
  validarMateria,
  validarProfesor,
  validarRangoAgenda,
  type PedidoReserva,
} from './turnos.reglas'
import type {
  AgendaListado,
  AgendaPropiaListado,
  AgendaProfesorQuery,
  AgendaPropiaQuery,
  AgendaQuery,
  AulasConTurnoListado,
  AulasConTurnoQuery,
  CrearTurno,
  DisponibilidadItem,
  DisponibilidadQuery,
  MateriasConTurnoListado,
  MateriasConTurnoQuery,
  TurnoDetalle,
  TurnosAlta,
} from './turnos.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. El cálculo de
// fechas y capacidad está en `turnos.reglas.ts` (puro); de alumnos, bloques, profesores y materias
// solo lee, por sus repositories.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearTurnosService({
  repository,
  alumnosRepository,
  bloquesRepository,
  profesoresRepository,
  materiasRepository,
  reloj,
}: {
  repository: Pick<
    TurnosRepository,
    | 'contarOcupacionPorBloque'
    | 'reservar'
    | 'buscarDetalle'
    | 'listarAgenda'
    | 'listarAgendaPropia'
    | 'listarMateriasConTurno'
    | 'listarAulasConTurno'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  bloquesRepository: Pick<BloquesRepository, 'buscarPorIds' | 'listarActivasDeProfesores'>
  profesoresRepository: Pick<
    ProfesoresRepository,
    'listarProfesoresActivosDeMateria' | 'buscarConAsignaciones' | 'buscarIdPorUsuario'
  >
  materiasRepository: Pick<MateriasRepository, 'buscarPorIds'>
  reloj?: Reloj
}) {
  /** 400 en `campo` si `fecha` es anterior a hoy (hoy se permite aunque la hora ya haya pasado). */
  function exigirNoPasada(fecha: string, fechaHoy: string, campo: string): void {
    if (fecha < fechaHoy) {
      throw new ValidationError(MENSAJE_FECHA_PASADA, {
        details: [{ path: [campo], message: MENSAJE_FECHA_PASADA }],
      })
    }
  }

  /**
   * Agenda de un profesor ya resuelto, común a la agenda propia (T-43) y a la que consulta mesa de
   * entradas (T-44). Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. El rango tiene que
   * estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`).
   */
  async function agendaDeProfesor(
    profesorId: number,
    desdePedido?: string,
    hastaPedido?: string,
  ): Promise<AgendaPropiaListado> {
    const desde = desdePedido ?? hoy(reloj)
    const hasta = hastaPedido ?? desde
    validarRangoAgenda(desde, hasta)

    const turnos = await repository.listarAgendaPropia({ profesorId, desde, hasta })
    return expandirOcurrencias(turnos, desde, hasta).map(({ fecha, turno }) => ({
      turnoId: turno.id,
      fecha,
      diaSemana: turno.diaSemana,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      alumno: turno.alumno,
      materia: turno.materia,
      aula: turno.aula,
      tipo: turno.tipo,
      estado: turno.estado,
    }))
  }

  return {
    /**
     * Horas en las que se puede buscar un turno para una materia (HU-07): las filas activas de
     * los profesores activos que la dictan, agrupadas como las muestra la UI (mismo profesor, día
     * y aula, horas contiguas), cada hora con su capacidad efectiva y su ocupación.
     *
     * - Con `fecha`: la ocupación es la de esa fecha y el día sale de ella (400 si es pasada o si
     *   contradice a `diaSemana`). Sin `fecha`: la próxima ocurrencia de cada día, hoy incluido
     *   (como el horario de bloques, T-33).
     * - Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA` (sin `details`).
     * - Un `profesorId` que no dicta la materia no es error: `[]`.
     * - Las horas llenas vienen igual (`lleno`). Si un recurrente entra en todas sus fechas lo
     *   decide el alta, no esta lectura.
     * - Orden: el de los profesores (apellido y nombre), después día y hora.
     */
    async disponibilidad(query: DisponibilidadQuery): Promise<DisponibilidadItem[]> {
      const fechaHoy = hoy(reloj)
      let diaSemana = query.diaSemana
      if (query.fecha !== undefined) {
        exigirNoPasada(query.fecha, fechaHoy, 'fecha')
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
      const fechaDe = (dia: number) => query.fecha ?? proximaFechaDelDia(dia, fechaHoy)
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
    },

    /**
     * Registra un turno (HU-07): una fila `turno` por hora elegida (y por tramo, si un recurrente
     * se crea solo donde hay lugar), todo o nada. Chequeos, en orden, antes de la transacción
     * (lecturas sin lock, para dar errores claros):
     * 1. `fechaInicio` anterior a hoy → 400.
     * 2. Alumno inexistente → 404.
     * 3. Filas inexistentes o inactivas → 404 por posición; de más de un profesor o día → 400.
     * 4. Fechas que no caen en el día de las filas → 400 en el campo.
     * 5. Profesor inactivo → 409 `PROFESOR_INACTIVO`.
     * 6. Materia inexistente (404), inactiva (409 `MATERIA_INACTIVA`) o no asignada al profesor
     *    (409 `MATERIA_NO_ASIGNADA`).
     * 7. `repository.reservar`, que bloquea, relee y decide con `planificarReserva`: lo anterior
     *    otra vez, `ALUMNO_SUPERPUESTO` y `BLOQUE_LLENO`.
     */
    async crear(datos: CrearTurno, actor: Actor): Promise<TurnosAlta> {
      exigirNoPasada(datos.fechaInicio, hoy(reloj), 'fechaInicio')
      // En una sesión única se guarda siempre `fechaFin = fechaInicio` (T-20).
      const fechaFin = datos.tipo === 'SESION_UNICA' ? datos.fechaInicio : (datos.fechaFin ?? null)

      // No se valida el estado del alumno: su baja no está implementada (dominio.md → Alumnos).
      const alumno = await alumnosRepository.buscarPorId(datos.alumnoId)
      if (!alumno) throw new NotFoundError('Alumno no encontrado')

      const filas = await bloquesRepository.buscarPorIds(datos.bloqueIds)
      const { profesorId, diaSemana } = validarFilas(datos.bloqueIds, filas)
      validarFechasEnDia(diaSemana, datos.fechaInicio, fechaFin)

      const profesor = await profesoresRepository.buscarConAsignaciones(profesorId, [
        datos.materiaId,
      ])
      validarProfesor(profesor)
      const [materia] = await materiasRepository.buscarPorIds([datos.materiaId])
      validarMateria(
        materia ?? null,
        profesor?.asignaciones.find((asignacion) => asignacion.materiaId === datos.materiaId) ??
          null,
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
        motivoConsulta: datos.motivoConsulta ?? null,
        asignarDondeHayLugar: datos.asignarDondeHayLugar,
      }
      const { turnos, fechasSinTurno } = await repository.reservar(
        {
          alumnoId: datos.alumnoId,
          profesorId,
          materiaId: datos.materiaId,
          bloqueIds: datos.bloqueIds,
          fechaInicio: datos.fechaInicio,
          fechaFin,
        },
        (snapshot) => planificarReserva(snapshot, pedido),
        actor,
      )
      return { cantidad: turnos.length, turnos, fechasSinTurno }
    },

    /** Detalle de un turno, en cualquier estado. 404 si no existe. */
    async obtener(id: number): Promise<TurnoDetalle> {
      const turno = await repository.buscarDetalle(id)
      if (!turno) throw new NotFoundError('Turno no encontrado')
      return turno
    },
    /**
     * Agenda de la fecha pedida; sin `fecha`, la de hoy (`hoy()` con el reloj del service).
     * `profesorId` (decisión T-42) da la vista personal de ese profesor ese día. `q` (T-36) busca
     * por nombre de alumno o de profesor, o sólo de alumno si ya se filtró por `profesorId`: se
     * normaliza igual que en el resto de la API (`terminosDeBusqueda`) antes de pasarla al
     * repository.
     */
    listarAgenda(query: AgendaQuery): Promise<AgendaListado> {
      return repository.listarAgenda({
        fecha: query.fecha ?? hoy(reloj),
        page: query.page,
        pageSize: query.pageSize,
        materiaId: query.materiaId,
        aulaId: query.aulaId,
        profesorId: query.profesorId,
        terminos: terminosDeBusqueda(query.q),
      })
    },

    /**
     * Agenda propia del profesor de la sesión (HU-10, T-25), de sólo lectura: una entrada por cada
     * ocurrencia de sus turnos dentro del rango, con alumno, materia, aula, horario y estado.
     *
     * - El profesor sale del `Actor` (`buscarIdPorUsuario`), **nunca de un parámetro**: nadie puede
     *   pedir la agenda de otro. Si el usuario no tiene ficha de profesor → 404.
     * - Sin `desde`, hoy; sin `hasta`, el mismo día que `desde` (la vista por día). El rango tiene
     *   que estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`).
     * - La expansión en ocurrencias es la de T-23 aplicada fecha por fecha (`expandirOcurrencias`
     *   sobre `ocupaLugarEn`): un recurrente aparece una vez por semana mientras su rango cubra la
     *   fecha, y una sesión única, sólo en la suya.
     * - Sin paginar (decisión T-43): el rango está acotado y es de un solo profesor. Ordenada por
     *   fecha y, dentro del día, por hora e id.
     */
    async listarAgendaPropia(query: AgendaPropiaQuery, actor: Actor): Promise<AgendaPropiaListado> {
      const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
      if (profesorId === null) throw new NotFoundError('El usuario no tiene ficha de profesor')
      return agendaDeProfesor(profesorId, query.desde, query.hasta)
    },

    /**
     * Agenda de cualquier profesor para mesa de entradas (T-44, ficha del profesor de HU-02): la
     * misma lógica y la misma forma que `listarAgendaPropia`, con el profesor fijo por `profesorId`.
     *
     * `buscarConAsignaciones` con `[]` se usa sólo para saber si el profesor existe (`null` → 404,
     * antes de validar el rango). No mira el estado a propósito: un profesor inactivo se puede
     * consultar, porque sus turnos históricos siguen existiendo.
     */
    async listarAgendaDeProfesor(query: AgendaProfesorQuery): Promise<AgendaPropiaListado> {
      const profesor = await profesoresRepository.buscarConAsignaciones(query.profesorId, [])
      if (!profesor) throw new NotFoundError('Profesor no encontrado')
      return agendaDeProfesor(query.profesorId, query.desde, query.hasta)
    },

    /** Selector de materias con turno activo en la fecha pedida; sin `fecha`, la de hoy. */
    listarMateriasConTurno(query: MateriasConTurnoQuery): Promise<MateriasConTurnoListado> {
      return repository.listarMateriasConTurno(query.fecha ?? hoy(reloj))
    },

    /** Selector de aulas con turno activo en la fecha pedida; sin `fecha`, la de hoy. */
    listarAulasConTurno(query: AulasConTurnoQuery): Promise<AulasConTurnoListado> {
      return repository.listarAulasConTurno(query.fecha ?? hoy(reloj))
    },
  }
}

export type TurnosService = ReturnType<typeof crearTurnosService>
