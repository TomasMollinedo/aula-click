import { NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import { type Actor, alumnoDeLaSesion } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { Adeudado, FiltroDeuda } from './cuentas.condiciones'
import type { CuentasRepository } from './cuentas.repository'
import { paginarEnMemoria, rangosDelPeriodo, totalDe } from './cuentas.reglas'
import type {
  AdeudadosGlobal,
  CuentaDelAlumno,
  FiltroCuentaQuery,
  GrupoDeCuenta,
  ListadoCuentaQuery,
  MiCuenta,
  OcurrenciaDeCuenta,
  OcurrenciaDeCuentaGlobal,
  ProximosGlobal,
} from './cuentas.validation'

// Cuenta del alumno y vistas globales de adeudados y próximos (HU-16, T-53); varias materias y la
// cuenta del portal (HU-25 y HU-37, T-101). No conoce HTTP ni Prisma: lanza AppError o sus
// subclases. No hace consultas propias: qué se adeuda y qué es próximo lo leen las condiciones por
// el repository; acá se calcula `hoy`, se chequea el alumno, se decide qué sección aplica al
// período (`rangosDelPeriodo`: la que no aplica no se lee), se suma, se pagina, se agrupa y se
// arman los DTOs.

const MENSAJE_ALUMNO_NO_ENCONTRADO = 'Alumno no encontrado'

/**
 * DTO de una ocurrencia de la cuenta, **campo por campo** (nunca con spread de la `Ocurrencia`:
 * `busqueda` es interno). Horas `HH:mm`. Sólo llegan `SIN_REGISTRAR` (adeudados) o `AGENDADO`
 * (próximos): lo garantizan las reglas.
 */
function aOcurrenciaDeCuenta({ ocurrencia, importe }: Adeudado): OcurrenciaDeCuenta {
  return {
    turnoId: ocurrencia.turnoId,
    fecha: ocurrencia.fecha,
    horaInicio: minutosAHora(ocurrencia.horaInicio),
    horaFin: minutosAHora(ocurrencia.horaFin),
    materia: { id: ocurrencia.materia.id, nombre: ocurrencia.materia.nombre },
    profesor: {
      id: ocurrencia.profesor.id,
      nombre: ocurrencia.profesor.nombre,
      apellido: ocurrencia.profesor.apellido,
    },
    estado: ocurrencia.estado as OcurrenciaDeCuenta['estado'],
    importe,
  }
}

/** El orden de las condiciones (fecha, hora de inicio y `turnoId`), para juntar varias lecturas. */
function porFechaHoraYTurno({ ocurrencia: a }: Adeudado, { ocurrencia: b }: Adeudado): number {
  return a.fecha.localeCompare(b.fecha) || a.horaInicio - b.horaInicio || a.turnoId - b.turnoId
}

/**
 * Las ocurrencias agrupadas por materia (por nombre y, si se repite, por id), cada una con su
 * subtotal. Dentro de cada grupo conservan el orden en que llegan.
 */
function agruparPorMateria(ocurrencias: readonly OcurrenciaDeCuenta[]): GrupoDeCuenta[] {
  const grupos = new Map<number, GrupoDeCuenta>()
  for (const ocurrencia of ocurrencias) {
    const grupo = grupos.get(ocurrencia.materia.id) ?? {
      materia: ocurrencia.materia,
      subtotal: 0,
      ocurrencias: [],
    }
    grupo.ocurrencias.push(ocurrencia)
    grupos.set(ocurrencia.materia.id, grupo)
  }
  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, subtotal: totalDe(grupo.ocurrencias) }))
    .sort(
      (a, b) =>
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') || a.materia.id - b.materia.id,
    )
}

/** La fila de una vista global: la ocurrencia con su alumno y el DNI leído aparte. */
function aOcurrenciaGlobal(
  adeudado: Adeudado,
  dnis: ReadonlyMap<number, string>,
): OcurrenciaDeCuentaGlobal {
  const { alumno } = adeudado.ocurrencia
  return {
    ...aOcurrenciaDeCuenta(adeudado),
    alumno: {
      id: alumno.id,
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      dni: dnis.get(alumno.id) ?? '',
    },
  }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearCuentasService({
  repository,
  alumnosRepository,
  reloj,
}: {
  repository: Pick<CuentasRepository, 'leerAdeudados' | 'leerProximos' | 'dnisDeAlumnos'>
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /** 404 si el alumno no existe. Su estado no importa: un alumno dado de baja puede deber. */
  async function exigirAlumno(alumnoId: number): Promise<void> {
    const alumno = await alumnosRepository.buscarPorId(alumnoId)
    if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)
  }

  /** El filtro de las condiciones: el período va tal cual se pidió (lo recortan ellas). */
  function aFiltroDeuda(
    filtro: FiltroCuentaQuery,
    alumnoId: number | undefined,
    materiaId: number | undefined,
    fechaHoy: string,
  ): FiltroDeuda {
    return {
      alumnoId,
      materiaId,
      profesorId: filtro.profesorId,
      desde: filtro.desde,
      hasta: filtro.hasta,
      hoy: fechaHoy,
    }
  }

  /**
   * Una sección (adeudados o próximos) de las materias pedidas (HU-25, T-101). Sin materias, una
   * lectura de todas; con una, esa lectura tal cual; con varias, una lectura por materia (sin
   * repetir ids), juntas en el orden de las condiciones. Cada materia se lee igual que sola: los
   * próximos no pasan del tope de cobro y el total de los adeudados es la suma de todas.
   */
  async function leerSeccion(
    leer: (filtro: FiltroDeuda) => Promise<Adeudado[]>,
    filtro: FiltroCuentaQuery,
    alumnoId: number | undefined,
    fechaHoy: string,
  ): Promise<Adeudado[]> {
    const materiaIds = [...new Set(filtro.materiaId ?? [])]
    if (materiaIds.length <= 1) {
      return leer(aFiltroDeuda(filtro, alumnoId, materiaIds[0], fechaHoy))
    }
    const porMateria = await Promise.all(
      materiaIds.map((materiaId) => leer(aFiltroDeuda(filtro, alumnoId, materiaId, fechaHoy))),
    )
    return porMateria.flat().sort(porFechaHoraYTurno)
  }

  /** La página de una vista global, con el DNI sólo de los alumnos de la página. */
  async function paginarConAlumno(
    items: readonly Adeudado[],
    query: { page: number; pageSize: number },
  ): Promise<Pick<AdeudadosGlobal, 'data' | 'meta'>> {
    const pagina = paginarEnMemoria(items, query)
    const dnis = await repository.dnisDeAlumnos(pagina.data.map((a) => a.ocurrencia.alumno.id))
    return { data: pagina.data.map((a) => aOcurrenciaGlobal(a, dnis)), meta: pagina.meta }
  }

  /**
   * La cuenta de un alumno que ya se sabe que existe. Una sección que no aplica al período va
   * `null` y no se lee; el total es sólo de los adeudados (los próximos nunca suman).
   */
  async function leerCuenta(alumnoId: number, filtro: FiltroCuentaQuery): Promise<CuentaDelAlumno> {
    const fechaHoy = hoy(reloj)
    const rangos = rangosDelPeriodo(filtro, fechaHoy)
    const [adeudados, proximos] = await Promise.all([
      rangos.adeudados === null
        ? null
        : leerSeccion(repository.leerAdeudados, filtro, alumnoId, fechaHoy),
      rangos.proximos === null
        ? null
        : leerSeccion(repository.leerProximos, filtro, alumnoId, fechaHoy),
    ])
    return {
      totalAdeudado: totalDe(adeudados ?? []),
      adeudados: adeudados && adeudados.map(aOcurrenciaDeCuenta),
      proximos: proximos && proximos.map(aOcurrenciaDeCuenta),
      limiteCobro: limiteDeCobro(fechaHoy),
    }
  }

  return {
    /**
     * Cuenta de un alumno: total adeudado, adeudados, próximos y el tope de cobro, con los filtros
     * de período, materias y profesor (`leerCuenta`). 404 si el alumno no existe.
     */
    async obtenerCuenta(
      alumnoId: number,
      filtro: FiltroCuentaQuery = {},
    ): Promise<CuentaDelAlumno> {
      await exigirAlumno(alumnoId)
      return leerCuenta(alumnoId, filtro)
    },

    /**
     * Cuenta del alumno de la sesión (portal, HU-37): la misma lectura que ve mesa de entradas sin
     * filtros (los mismos importes y el mismo total), con adeudados y próximos agrupados por materia
     * con su subtotal. 403 si la sesión no tiene alumno.
     */
    async miCuenta(actor: Actor): Promise<MiCuenta> {
      const cuenta = await leerCuenta(alumnoDeLaSesion(actor), {})
      return {
        totalAdeudado: cuenta.totalAdeudado,
        adeudados: agruparPorMateria(cuenta.adeudados ?? []),
        proximos: agruparPorMateria(cuenta.proximos ?? []),
        limiteCobro: cuenta.limiteCobro,
      }
    },

    /**
     * Vista global de la deuda, paginada en memoria, del más antiguo al más reciente, con el total
     * de **todos** los adeudados del filtro (no de la página). Con `alumnoId`, 404 si el alumno no
     * existe. Si la sección no aplica al período (`aplica: false`), vacía y en 0, sin leer nada. El
     * DNI se lee sólo para los alumnos de la página.
     */
    async listarAdeudados(query: ListadoCuentaQuery): Promise<AdeudadosGlobal> {
      if (query.alumnoId !== undefined) await exigirAlumno(query.alumnoId)
      const fechaHoy = hoy(reloj)
      const aplica = rangosDelPeriodo(query, fechaHoy).adeudados !== null
      const adeudados = aplica
        ? await leerSeccion(repository.leerAdeudados, query, query.alumnoId, fechaHoy)
        : []
      return {
        ...(await paginarConAlumno(adeudados, query)),
        totalAdeudado: totalDe(adeudados),
        aplica,
      }
    },

    /**
     * Vista global de los próximos, paginada en memoria, por fecha, hora de inicio y `turnoId`,
     * con el tope de cobro. No tiene total: los próximos no son deuda. Con `alumnoId`, 404 si el
     * alumno no existe. Si la sección no aplica al período (`aplica: false`), vacía, sin leer nada.
     */
    async listarProximos(query: ListadoCuentaQuery): Promise<ProximosGlobal> {
      if (query.alumnoId !== undefined) await exigirAlumno(query.alumnoId)
      const fechaHoy = hoy(reloj)
      const aplica = rangosDelPeriodo(query, fechaHoy).proximos !== null
      const proximos = aplica
        ? await leerSeccion(repository.leerProximos, query, query.alumnoId, fechaHoy)
        : []
      return {
        ...(await paginarConAlumno(proximos, query)),
        aplica,
        limiteCobro: limiteDeCobro(fechaHoy),
      }
    },
  }
}

export type CuentasService = ReturnType<typeof crearCuentasService>
