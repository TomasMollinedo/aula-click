import { terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { TurnosRepository } from './turnos.repository'
import type {
  AgendaListado,
  AgendaQuery,
  AulasConTurnoListado,
  AulasConTurnoQuery,
  MateriasConTurnoListado,
  MateriasConTurnoQuery,
} from './turnos.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo. Importa el repository solo como tipo, así el service
 * no carga Prisma ni `@/config/env`.
 */
export function crearTurnosService({
  repository,
  reloj,
}: {
  repository: TurnosRepository
  reloj?: Reloj
}) {
  return {
    /**
     * Agenda de la fecha pedida; sin `fecha`, la de hoy (`hoy()` con el reloj del service). `q`
     * (decisión T-36) busca por nombre de alumno o de profesor: se normaliza igual que en el
     * resto de la API (`terminosDeBusqueda`) antes de pasarla al repository.
     */
    listarAgenda(query: AgendaQuery): Promise<AgendaListado> {
      return repository.listarAgenda({
        fecha: query.fecha ?? hoy(reloj),
        page: query.page,
        pageSize: query.pageSize,
        materiaId: query.materiaId,
        aulaId: query.aulaId,
        terminos: terminosDeBusqueda(query.q),
      })
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
