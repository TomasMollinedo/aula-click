import { NotFoundError } from '@/server/errors'
import type { AulasRepository } from '@/server/features/aulas/aulas.repository'
import { clavePrioridad, type Prioridad } from '@/server/features/examenes/examenes.condiciones'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { minutosAHora } from '@/server/shared/zod'
import type { AgendasRepository, Ocurrencia, PrioridadDeTurno } from './agendas.repository'
import { validarRangoAgenda } from './agendas.reglas'
import type {
  AgendaCentroListado,
  AgendaCentroQuery,
  AgendaItem,
  AgendaListado,
  AgendaProfesorQuery,
  AgendaPropiaItem,
  AgendaPropiaListado,
  AgendaPropiaQuery,
  AgendaQuery,
  AulasConTurnoListado,
  AulasConTurnoQuery,
  MateriasConTurnoListado,
  MateriasConTurnoQuery,
} from './agendas.validation'

// Reglas de las agendas. No conoce HTTP ni Prisma: lanza AppError o sus subclases. Las ocurrencias
// salen del motor de `turnos` y la prioridad del de `examenes` (vía el repository) y acá sólo se
// filtran, ordenan y paginan. Las agendas muestran **todas** las ocurrencias, también las canceladas
// (HU-13: se siguen viendo con su estado; T-57 cambió el criterio de T-23); una cancelada no tiene
// prioridad. Sólo los selectores de materias y aulas siguen contando las no canceladas. De
// profesores y aulas solo lee, por sus repositories.

/** Las ocurrencias no canceladas: lo que cuentan los selectores de materias y aulas. */
function noCancelada(ocurrencia: Ocurrencia): boolean {
  return ocurrencia.estado !== 'CANCELADO'
}

function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Todas las palabras están en `busqueda` (misma regla que `contains` sobre la columna, T-36). */
function coinciden(busqueda: string, terminos: readonly string[]): boolean {
  return terminos.every((termino) => busqueda.includes(termino))
}

/** Una ocurrencia con su prioridad (y el examen que la determina); `null` si está cancelada. */
type ConPrioridad = { ocurrencia: Ocurrencia; prioridad: PrioridadDeTurno | null }

/** Filtros de estado y prioridad, comunes a las cuatro agendas. */
type FiltroEstadoYPrioridad = { estado?: Ocurrencia['estado']; prioridad?: Prioridad }

/** Fecha, hora, profesor (apellido y nombre, vía su `busqueda`) e id del turno. */
function porFechaHoraYProfesor(a: ConPrioridad, b: ConPrioridad): number {
  return (
    compararTexto(a.ocurrencia.fecha, b.ocurrencia.fecha) ||
    a.ocurrencia.horaInicio - b.ocurrencia.horaInicio ||
    compararTexto(a.ocurrencia.profesor.busqueda, b.ocurrencia.profesor.busqueda) ||
    a.ocurrencia.turnoId - b.ocurrencia.turnoId
  )
}

/** Ítem de la agenda de un profesor, campo por campo (sin `busqueda`, que es interno del motor). */
function aAgendaPropiaItem({ ocurrencia, prioridad }: ConPrioridad): AgendaPropiaItem {
  return {
    turnoId: ocurrencia.turnoId,
    fecha: ocurrencia.fecha,
    bloqueAgendaId: ocurrencia.bloqueAgendaId,
    diaSemana: ocurrencia.diaSemana,
    horaInicio: minutosAHora(ocurrencia.horaInicio),
    horaFin: minutosAHora(ocurrencia.horaFin),
    alumno: {
      id: ocurrencia.alumno.id,
      apellido: ocurrencia.alumno.apellido,
      nombre: ocurrencia.alumno.nombre,
    },
    materia: { id: ocurrencia.materia.id, nombre: ocurrencia.materia.nombre },
    aula: { id: ocurrencia.aula.id, nombre: ocurrencia.aula.nombre },
    tipo: ocurrencia.tipo,
    estado: ocurrencia.estado,
    estadoPago: ocurrencia.pago.estado,
    prioridad: prioridad?.prioridad ?? null,
    examen: prioridad?.examen ?? null,
  }
}

/** Ítem de la agenda diaria y de la del centro: el de un profesor más el profesor del bloque. */
function aAgendaItem(conPrioridad: ConPrioridad): AgendaItem {
  const { profesor } = conPrioridad.ocurrencia
  return {
    ...aAgendaPropiaItem(conPrioridad),
    profesor: { id: profesor.id, apellido: profesor.apellido, nombre: profesor.nombre },
  }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearAgendasService({
  repository,
  profesoresRepository,
  aulasRepository,
  reloj,
}: {
  repository: Pick<AgendasRepository, 'leerOcurrencias' | 'leerPrioridades'>
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario' | 'buscarConAsignaciones'>
  aulasRepository: Pick<AulasRepository, 'listar'>
  reloj?: Reloj
}) {
  /** Ocurrencias no canceladas de un solo día (sólo para los selectores de materias y aulas). */
  async function ocurrenciasNoCanceladasDelDia(fecha: string): Promise<Ocurrencia[]> {
    return (await repository.leerOcurrencias({ desde: fecha, hasta: fecha }, reloj)).filter(
      noCancelada,
    )
  }

  /**
   * Aplica los filtros de estado y de prioridad y le suma a cada ocurrencia su prioridad (HU-18).
   * Una sola consulta de prioridades para todas las no canceladas (las canceladas no tienen y no se
   * piden). Filtrar por prioridad deja afuera las canceladas. Mantiene el orden que recibe.
   */
  async function conPrioridades(
    ocurrencias: readonly Ocurrencia[],
    { estado, prioridad }: FiltroEstadoYPrioridad,
  ): Promise<ConPrioridad[]> {
    const candidatas = ocurrencias.filter(
      (ocurrencia) => estado === undefined || ocurrencia.estado === estado,
    )
    const prioridades = await repository.leerPrioridades(
      candidatas
        .filter(noCancelada)
        .map(({ alumnoId, materiaId, fecha }) => ({ alumnoId, materiaId, fecha })),
    )
    const resultado = candidatas.map((ocurrencia) => ({
      ocurrencia,
      prioridad: noCancelada(ocurrencia)
        ? (prioridades.get(clavePrioridad(ocurrencia)) ?? null)
        : null,
    }))
    return prioridad === undefined
      ? resultado
      : resultado.filter((item) => item.prioridad?.prioridad === prioridad)
  }

  /**
   * Agenda de un profesor ya resuelto, común a la agenda propia (T-43) y a la que consulta mesa de
   * entradas (T-44). Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. El rango tiene que
   * estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`). El motor ya las devuelve
   * por fecha, hora e id del turno.
   */
  async function agendaDeProfesor(
    profesorId: number,
    desdePedido: string | undefined,
    hastaPedido: string | undefined,
    filtro: FiltroEstadoYPrioridad,
  ): Promise<AgendaPropiaListado> {
    const desde = desdePedido ?? hoy(reloj)
    const hasta = hastaPedido ?? desde
    validarRangoAgenda(desde, hasta)

    const ocurrencias = await repository.leerOcurrencias({ desde, hasta, profesorId }, reloj)
    return (await conPrioridades(ocurrencias, filtro)).map(aAgendaPropiaItem)
  }

  return {
    /**
     * Agenda de la fecha pedida; sin `fecha`, la de hoy (`hoy()` con el reloj del service). Incluye
     * las canceladas, con su estado y sin prioridad (T-57). `profesorId` (decisión T-42) da la vista
     * personal de ese profesor ese día. `q` (T-36) busca por palabras (`terminosDeBusqueda`) en el
     * nombre del alumno o en el del profesor, nunca mezcladas; con `profesorId`, sólo en el del
     * alumno. `estado` y `prioridad` filtran y se combinan con todo lo anterior. Ordenada por hora
     * de inicio, dentro de la hora por profesor (apellido y nombre, vía su `busqueda`) y por id del
     * turno; paginada.
     */
    async listarAgenda(query: AgendaQuery): Promise<AgendaListado> {
      const terminos = terminosDeBusqueda(query.q)
      const fecha = query.fecha ?? hoy(reloj)
      const ocurrencias = await repository.leerOcurrencias(
        {
          desde: fecha,
          hasta: fecha,
          materiaId: query.materiaId,
          aulaId: query.aulaId,
          profesorId: query.profesorId,
        },
        reloj,
      )
      const buscadas =
        terminos.length === 0
          ? ocurrencias
          : ocurrencias.filter(
              (ocurrencia) =>
                coinciden(ocurrencia.alumno.busqueda, terminos) ||
                (query.profesorId === undefined &&
                  coinciden(ocurrencia.profesor.busqueda, terminos)),
            )
      const ordenadas = (await conPrioridades(buscadas, query)).sort(porFechaHoraYProfesor)
      const { skip, take } = calcularSkipTake(query)
      return {
        data: ordenadas.slice(skip, skip + take).map(aAgendaItem),
        meta: armarMeta(query, ordenadas.length),
      }
    },

    /**
     * Agenda del centro (T-57), para el calendario semanal de mesa de entradas: las ocurrencias de
     * **todos los profesores** en `[desde, hasta]`, incluidas las canceladas. El rango es
     * obligatorio, tiene que estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`).
     * Filtra por profesor, materia, aula, estado y prioridad, combinables. Sin paginar; ordenada por
     * fecha, hora, profesor y id del turno. Agrupar por clase (fecha + bloque) es presentación.
     */
    async listarAgendaDelCentro(query: AgendaCentroQuery): Promise<AgendaCentroListado> {
      validarRangoAgenda(query.desde, query.hasta)
      const ocurrencias = await repository.leerOcurrencias(
        {
          desde: query.desde,
          hasta: query.hasta,
          profesorId: query.profesorId,
          materiaId: query.materiaId,
          aulaId: query.aulaId,
        },
        reloj,
      )
      return (await conPrioridades(ocurrencias, query)).sort(porFechaHoraYProfesor).map(aAgendaItem)
    },

    /**
     * Agenda propia del profesor de la sesión (HU-10, T-25), de sólo lectura: una entrada por cada
     * ocurrencia de sus turnos dentro del rango (también las canceladas, T-57), con alumno, materia,
     * aula, horario, estado, pago y prioridad. `estado` y `prioridad` filtran.
     *
     * - El profesor sale del `Actor` (`buscarIdPorUsuario`), **nunca de un parámetro**: nadie puede
     *   pedir la agenda de otro. Si el usuario no tiene ficha de profesor → 404.
     * - Sin `desde`, hoy; sin `hasta`, el mismo día que `desde` (la vista por día). El rango tiene
     *   que estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`).
     * - Sin paginar (decisión T-43): el rango está acotado y es de un solo profesor. Ordenada por
     *   fecha y, dentro del día, por hora e id.
     */
    async listarAgendaPropia(query: AgendaPropiaQuery, actor: Actor): Promise<AgendaPropiaListado> {
      const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
      if (profesorId === null) throw new NotFoundError('El usuario no tiene ficha de profesor')
      return agendaDeProfesor(profesorId, query.desde, query.hasta, query)
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
      return agendaDeProfesor(query.profesorId, query.desde, query.hasta, query)
    },

    /**
     * Selector de materias con al menos una ocurrencia no cancelada en la fecha pedida (sin
     * `fecha`, la de hoy). Ordenadas por nombre sin tildes ni mayúsculas (`normalizarBusqueda`, la
     * misma `busqueda` que guarda `materias`) y luego `id`. A propósito **no filtra por
     * `Materia.estado`**: importa si se dictó ese día, no si hoy sigue activa.
     */
    async listarMateriasConTurno(query: MateriasConTurnoQuery): Promise<MateriasConTurnoListado> {
      const ocurrencias = await ocurrenciasNoCanceladasDelDia(query.fecha ?? hoy(reloj))
      const materias = new Map(
        ocurrencias.map((o) => [o.materia.id, { id: o.materia.id, nombre: o.materia.nombre }]),
      )
      return [...materias.values()].sort(
        (a, b) =>
          compararTexto(normalizarBusqueda(a.nombre), normalizarBusqueda(b.nombre)) || a.id - b.id,
      )
    },

    /**
     * Selector de aulas con al menos una ocurrencia no cancelada en la fecha pedida (sin `fecha`,
     * la de hoy), en el orden del catálogo de `aulas` (nombre e `id`). A propósito **no filtra por
     * `Aula.estado`**: importa si se usó ese día, no si hoy sigue activa.
     */
    async listarAulasConTurno(query: AulasConTurnoQuery): Promise<AulasConTurnoListado> {
      const ocurrencias = await ocurrenciasNoCanceladasDelDia(query.fecha ?? hoy(reloj))
      const usadas = new Set(ocurrencias.map((ocurrencia) => ocurrencia.aula.id))
      if (usadas.size === 0) return []
      return (await aulasRepository.listar())
        .filter((aula) => usadas.has(aula.id))
        .map((aula) => ({ id: aula.id, nombre: aula.nombre }))
    },
  }
}

export type AgendasService = ReturnType<typeof crearAgendasService>
