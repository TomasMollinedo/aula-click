import { hoy, type Reloj } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import type { TableroRepository } from './tablero.repository'
import {
  FILAS_POR_PAGINA_ASISTENCIA,
  ORDEN_PROFESORES_POR_DEFECTO,
  alumnosAtendidos,
  clasesDelPeriodo,
  conteosDeAsistencia,
  filasDeMaterias,
  filasDeProfesores,
  instantesDelPeriodo,
  materiasConMasDemanda,
  ocupacion,
  ordenarProfesores,
  profesoresConMasTurnos,
  resumenDeAsistencia,
  soloQueNoRegistran,
  turnosPorEstado,
} from './tablero.reglas'
import type {
  Tablero,
  TableroAsistencia,
  TableroAsistenciaCompleta,
  TableroAsistenciaQuery,
  TableroQuery,
} from './tablero.validation'

// Tablero del gerente (HU-21, T-61). No conoce HTTP ni Prisma. Sólo lectura y sólo agregados: no
// hace consultas propias ni reimplementa reglas. Acá se calcula `hoy` **una vez**, se orquestan las
// lecturas del repository, se aplican las reglas puras y se arma el DTO campo por campo.

/** Una página de `filas`: `{ data, meta }` con `FILAS_POR_PAGINA_ASISTENCIA` filas por página. */
function paginar<T>(filas: readonly T[], page: number) {
  const consulta = { page, pageSize: FILAS_POR_PAGINA_ASISTENCIA }
  const { skip, take } = calcularSkipTake(consulta)
  return { data: filas.slice(skip, skip + take), meta: armarMeta(consulta, filas.length) }
}

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
  /**
   * La pestaña "Asistencia" con las tablas **completas**: todos los profesores en el orden por
   * defecto (los de más turnos cerrados sin registrar primero) y todas las materias. Es lo que
   * lleva el PDF; no es una respuesta del JSON.
   */
  async function asistenciaCompleta({
    desde,
    hasta,
  }: Pick<TableroQuery, 'desde' | 'hasta'>): Promise<TableroAsistenciaCompleta> {
    const fechaHoy = hoy(reloj)
    const ocurrencias = await repository.ocurrenciasDelPeriodo({ desde, hasta }, reloj)
    return {
      periodo: { desde, hasta },
      hoy: fechaHoy,
      resumen: resumenDeAsistencia(ocurrencias),
      profesores: ordenarProfesores(filasDeProfesores(ocurrencias), ORDEN_PROFESORES_POR_DEFECTO),
      materias: filasDeMaterias(ocurrencias),
    }
  }

  return {
    asistenciaCompleta,

    /**
     * Indicadores del período `[desde, hasta]` (ya validado): la sección "General". Las cinco
     * lecturas independientes van juntas y sin transacción (son de sólo lectura: un desfase de
     * milisegundos entre ellas es aceptable); las capacidades, después, sólo de los bloques con
     * alguna clase. El total adeudado es a `hoy`, sin período.
     */
    async obtener({ desde, hasta }: TableroQuery): Promise<Tablero> {
      const fechaHoy = hoy(reloj)
      const instantes = instantesDelPeriodo(desde, hasta)
      const [ocurrencias, alumnosNuevos, totalCobrado, cobradoPorForma, totalAdeudado] =
        await Promise.all([
          repository.ocurrenciasDelPeriodo({ desde, hasta }, reloj),
          repository.contarAlumnosNuevos(instantes.desde, instantes.hasta),
          repository.totalCobrado({ desde, hasta }),
          repository.totalCobradoPorForma({ desde, hasta }),
          repository.totalAdeudado({ hoy: fechaHoy }),
        ])
      const bloqueAgendaIds = [
        ...new Set(clasesDelPeriodo(ocurrencias).map((clase) => clase.bloqueAgendaId)),
      ]
      const capacidades = await repository.capacidadesDeBloques(bloqueAgendaIds)

      const turnos = turnosPorEstado(ocurrencias, { hasta, hoy: fechaHoy })
      const ocupacionDelPeriodo = ocupacion(ocurrencias, capacidades)
      const asistencia = conteosDeAsistencia(ocurrencias)
      return {
        periodo: { desde, hasta },
        hoy: fechaHoy,
        turnos: {
          total: turnos.total,
          cancelados: turnos.cancelados,
          sinRegistrar: turnos.sinRegistrar,
          agendados: turnos.agendados,
          asistio: asistencia.asistio,
          noAsistio: asistencia.noAsistio,
        },
        ocupacion: {
          turnos: ocupacionDelPeriodo.turnos,
          capacidad: ocupacionDelPeriodo.capacidad,
          porcentaje: ocupacionDelPeriodo.porcentaje,
        },
        alumnos: { nuevos: alumnosNuevos, atendidos: alumnosAtendidos(ocurrencias) },
        materiasConMasDemanda: materiasConMasDemanda(ocurrencias),
        profesoresConMasTurnos: profesoresConMasTurnos(ocurrencias),
        pagos: {
          totalCobrado,
          cobradoPorForma: {
            EFECTIVO: cobradoPorForma.EFECTIVO,
            TRANSFERENCIA: cobradoPorForma.TRANSFERENCIA,
            DEBITO: cobradoPorForma.DEBITO,
          },
          totalAdeudado,
        },
      }
    },

    /**
     * La pestaña "Asistencia" del período, con las tablas de profesores y materias **paginadas**.
     * Una sola lectura de ocurrencias (el mismo criterio que `obtener`, decisión T-114) y reglas
     * puras sobre ella. El filtro y el orden valen sólo para la tabla de profesores; el resumen y
     * la tabla de materias son siempre los del período entero.
     */
    async obtenerAsistencia(query: TableroAsistenciaQuery): Promise<TableroAsistencia> {
      const {
        periodo,
        hoy: fechaHoy,
        resumen,
        profesores,
        materias,
      } = await asistenciaCompleta(query)
      const deProfesores = ordenarProfesores(
        query.soloSinRegistrar === 'true' ? soloQueNoRegistran(profesores) : profesores,
        { orden: query.orden, direccion: query.direccion },
      )
      return {
        periodo,
        hoy: fechaHoy,
        resumen,
        profesores: paginar(deProfesores, query.paginaProfesores),
        materias: paginar(materias, query.paginaMaterias),
      }
    },
  }
}

export type TableroService = ReturnType<typeof crearTableroService>
