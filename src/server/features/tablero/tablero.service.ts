import { hoy, type Reloj } from '@/server/shared/fechas'
import type { TableroRepository } from './tablero.repository'
import {
  clasesDelPeriodo,
  instantesDelPeriodo,
  materiasConMasDemanda,
  ocupacion,
  turnosPorEstado,
} from './tablero.reglas'
import type { Tablero, TableroQuery } from './tablero.validation'

// Tablero del gerente (HU-21, T-61). No conoce HTTP ni Prisma. Sólo lectura y sólo agregados: no
// hace consultas propias ni reimplementa reglas. Acá se calcula `hoy` **una vez**, se orquestan las
// lecturas del repository, se aplican las reglas puras y se arma el DTO campo por campo.

/**
 * Indicador que depende de la asistencia (HU-22, definición F): exactamente `{ disponible: false }`.
 * No se calcula con ningún sustituto.
 */
const noDisponible = () => ({ disponible: false as const })

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Lo importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearTableroService({
  repository,
  reloj,
}: {
  repository: TableroRepository
  reloj?: Reloj
}) {
  return {
    /**
     * Indicadores del período `[desde, hasta]` (ya validado). Las cuatro lecturas independientes
     * van juntas y sin transacción (son de sólo lectura: un desfase de milisegundos entre ellas es
     * aceptable); las capacidades, después, sólo de los bloques con alguna clase. El total adeudado
     * es a `hoy`, sin período.
     */
    async obtener({ desde, hasta }: TableroQuery): Promise<Tablero> {
      const fechaHoy = hoy(reloj)
      const instantes = instantesDelPeriodo(desde, hasta)
      const [ocurrencias, alumnosNuevos, totalCobrado, totalAdeudado] = await Promise.all([
        repository.ocurrenciasDelPeriodo({ desde, hasta }, reloj),
        repository.contarAlumnosNuevos(instantes.desde, instantes.hasta),
        repository.totalCobrado({ desde, hasta }),
        repository.totalAdeudado({ hoy: fechaHoy }),
      ])
      const bloqueAgendaIds = [
        ...new Set(clasesDelPeriodo(ocurrencias).map((clase) => clase.bloqueAgendaId)),
      ]
      const capacidades = await repository.capacidadesDeBloques(bloqueAgendaIds)

      const turnos = turnosPorEstado(ocurrencias, { hasta, hoy: fechaHoy })
      const ocupacionDelPeriodo = ocupacion(ocurrencias, capacidades)
      return {
        periodo: { desde, hasta },
        hoy: fechaHoy,
        turnos: {
          total: turnos.total,
          cancelados: turnos.cancelados,
          sinRegistrar: turnos.sinRegistrar,
          agendados: turnos.agendados,
          asistio: noDisponible(),
          noAsistio: noDisponible(),
        },
        ocupacion: {
          turnos: ocupacionDelPeriodo.turnos,
          capacidad: ocupacionDelPeriodo.capacidad,
          porcentaje: ocupacionDelPeriodo.porcentaje,
        },
        alumnos: { nuevos: alumnosNuevos, atendidos: noDisponible() },
        materiasConMasDemanda: materiasConMasDemanda(ocurrencias),
        profesoresConMasActividad: noDisponible(),
        pagos: { totalCobrado, totalAdeudado },
      }
    },
  }
}

export type TableroService = ReturnType<typeof crearTableroService>
