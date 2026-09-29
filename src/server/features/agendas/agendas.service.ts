import { NotFoundError } from '@/server/errors'
import type { AulasRepository } from '@/server/features/aulas/aulas.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { minutosAHora } from '@/server/shared/zod'
import type { AgendasRepository, Ocurrencia } from './agendas.repository'
import { validarRangoAgenda } from './agendas.reglas'
import type {
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
// salen del motor de `turnos` (vía el repository) y acá sólo se filtran, ordenan y paginan. Por
// ahora las agendas no muestran las ocurrencias canceladas (mostrarlas, con la prioridad y el pago,
// es T-57). De profesores y aulas solo lee, por sus repositories.

/** Por ahora las agendas muestran sólo las ocurrencias no canceladas (T-23; T-57 lo cambia). */
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

/** Ítem de la agenda diaria, campo por campo (sin `busqueda`, que es interno del motor). */
function aAgendaItem(ocurrencia: Ocurrencia): AgendaItem {
  return {
    id: ocurrencia.turnoId,
    alumno: {
      id: ocurrencia.alumno.id,
      apellido: ocurrencia.alumno.apellido,
      nombre: ocurrencia.alumno.nombre,
    },
    profesor: {
      id: ocurrencia.profesor.id,
      apellido: ocurrencia.profesor.apellido,
      nombre: ocurrencia.profesor.nombre,
    },
    materia: { id: ocurrencia.materia.id, nombre: ocurrencia.materia.nombre },
    aula: { id: ocurrencia.aula.id, nombre: ocurrencia.aula.nombre },
    horaInicio: minutosAHora(ocurrencia.horaInicio),
    horaFin: minutosAHora(ocurrencia.horaFin),
    // Sólo los turnos ACTIVO generan ocurrencias: el estado del turno es siempre este.
    estado: 'ACTIVO',
  }
}

/** Ítem de la agenda de un profesor, campo por campo. */
function aAgendaPropiaItem(ocurrencia: Ocurrencia): AgendaPropiaItem {
  return {
    turnoId: ocurrencia.turnoId,
    fecha: ocurrencia.fecha,
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
    estado: 'ACTIVO',
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
  repository: Pick<AgendasRepository, 'leerOcurrencias'>
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario' | 'buscarConAsignaciones'>
  aulasRepository: Pick<AulasRepository, 'listar'>
  reloj?: Reloj
}) {
  /** Ocurrencias no canceladas de un solo día (agenda diaria y sus selectores). */
  async function ocurrenciasDelDia(
    fecha: string,
    filtro: { materiaId?: number; aulaId?: number; profesorId?: number } = {},
  ): Promise<Ocurrencia[]> {
    return (
      await repository.leerOcurrencias({ desde: fecha, hasta: fecha, ...filtro }, reloj)
    ).filter(noCancelada)
  }

  /**
   * Agenda de un profesor ya resuelto, común a la agenda propia (T-43) y a la que consulta mesa de
   * entradas (T-44). Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. El rango tiene que
   * estar en orden y no superar `MAX_DIAS_AGENDA` días (400 en `hasta`). El motor ya las devuelve
   * por fecha, hora e id del turno.
   */
  async function agendaDeProfesor(
    profesorId: number,
    desdePedido?: string,
    hastaPedido?: string,
  ): Promise<AgendaPropiaListado> {
    const desde = desdePedido ?? hoy(reloj)
    const hasta = hastaPedido ?? desde
    validarRangoAgenda(desde, hasta)

    const ocurrencias = await repository.leerOcurrencias({ desde, hasta, profesorId }, reloj)
    return ocurrencias.filter(noCancelada).map(aAgendaPropiaItem)
  }

  return {
    /**
     * Agenda de la fecha pedida; sin `fecha`, la de hoy (`hoy()` con el reloj del service).
     * `profesorId` (decisión T-42) da la vista personal de ese profesor ese día. `q` (T-36) busca
     * por palabras (`terminosDeBusqueda`) en el nombre del alumno o en el del profesor, nunca
     * mezcladas; con `profesorId`, sólo en el del alumno. Ordenada por hora de inicio, dentro de la
     * hora por profesor (apellido y nombre, vía su `busqueda`) y por id del turno; paginada.
     */
    async listarAgenda(query: AgendaQuery): Promise<AgendaListado> {
      const terminos = terminosDeBusqueda(query.q)
      const ocurrencias = await ocurrenciasDelDia(query.fecha ?? hoy(reloj), {
        materiaId: query.materiaId,
        aulaId: query.aulaId,
        profesorId: query.profesorId,
      })
      const filtradas =
        terminos.length === 0
          ? ocurrencias
          : ocurrencias.filter(
              (ocurrencia) =>
                coinciden(ocurrencia.alumno.busqueda, terminos) ||
                (query.profesorId === undefined &&
                  coinciden(ocurrencia.profesor.busqueda, terminos)),
            )
      const ordenadas = [...filtradas].sort(
        (a, b) =>
          a.horaInicio - b.horaInicio ||
          compararTexto(a.profesor.busqueda, b.profesor.busqueda) ||
          a.turnoId - b.turnoId,
      )
      const { skip, take } = calcularSkipTake(query)
      return {
        data: ordenadas.slice(skip, skip + take).map(aAgendaItem),
        meta: armarMeta(query, ordenadas.length),
      }
    },

    /**
     * Agenda propia del profesor de la sesión (HU-10, T-25), de sólo lectura: una entrada por cada
     * ocurrencia no cancelada de sus turnos dentro del rango, con alumno, materia, aula, horario y
     * estado.
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

    /**
     * Selector de materias con al menos una ocurrencia no cancelada en la fecha pedida (sin
     * `fecha`, la de hoy). Ordenadas por nombre sin tildes ni mayúsculas (`normalizarBusqueda`, la
     * misma `busqueda` que guarda `materias`) y luego `id`. A propósito **no filtra por
     * `Materia.estado`**: importa si se dictó ese día, no si hoy sigue activa.
     */
    async listarMateriasConTurno(query: MateriasConTurnoQuery): Promise<MateriasConTurnoListado> {
      const ocurrencias = await ocurrenciasDelDia(query.fecha ?? hoy(reloj))
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
      const ocurrencias = await ocurrenciasDelDia(query.fecha ?? hoy(reloj))
      const usadas = new Set(ocurrencias.map((ocurrencia) => ocurrencia.aula.id))
      if (usadas.size === 0) return []
      return (await aulasRepository.listar())
        .filter((aula) => usadas.has(aula.id))
        .map((aula) => ({ id: aula.id, nombre: aula.nombre }))
    },
  }
}

export type AgendasService = ReturnType<typeof crearAgendasService>
