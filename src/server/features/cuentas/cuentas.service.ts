import { NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { agruparPorMateria, limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import { type Actor, alumnoDeLaSesion } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { Adeudado, FiltroDeuda } from './cuentas.condiciones'
import type { CuentasRepository } from './cuentas.repository'
import { opcionesDeLaCuenta, paginarEnMemoria, rangosDelPeriodo, totalDe } from './cuentas.reglas'
import type {
  AdeudadosGlobal,
  CuentaDelAlumno,
  FiltroCuentaQuery,
  GrupoDeCuenta,
  ListadoCuentaQuery,
  MiCuenta,
  OcurrenciaDeCuenta,
  OcurrenciaDeCuentaGlobal,
  OpcionesDeCuenta,
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

/**
 * Las ocurrencias agrupadas por materia, con su subtotal: el agrupado del comprobante
 * (`agruparPorMateria`, de `pagos`), con las ocurrencias de cada grupo en el campo del contrato.
 */
function gruposDeCuenta(ocurrencias: readonly OcurrenciaDeCuenta[]): GrupoDeCuenta[] {
  return agruparPorMateria(ocurrencias).map(({ materia, subtotal, turnos }) => ({
    materia,
    subtotal,
    ocurrencias: turnos,
  }))
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
  repository: Pick<
    CuentasRepository,
    'leerAdeudados' | 'leerProximos' | 'dnisDeAlumnos' | 'estadosDeMaterias'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /** 404 si el alumno no existe. Su estado no importa: un alumno dado de baja puede deber. */
  async function exigirAlumno(alumnoId: number): Promise<void> {
    const alumno = await alumnosRepository.buscarPorId(alumnoId)
    if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)
  }

  /**
   * El filtro de las condiciones: el período va tal cual se pidió (lo recortan ellas) y las
   * materias, todas las pedidas (HU-25, T-101: una lectura para todas, sin repetidos).
   */
  function aFiltroDeuda(
    filtro: FiltroCuentaQuery,
    alumnoId: number | undefined,
    fechaHoy: string,
  ): FiltroDeuda {
    return {
      alumnoId,
      materiaIds: filtro.materiaId,
      profesorId: filtro.profesorId,
      desde: filtro.desde,
      hasta: filtro.hasta,
      hoy: fechaHoy,
    }
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
    const filtroDeuda = aFiltroDeuda(filtro, alumnoId, fechaHoy)
    const [adeudados, proximos] = await Promise.all([
      rangos.adeudados === null ? null : repository.leerAdeudados(filtroDeuda),
      rangos.proximos === null ? null : repository.leerProximos(filtroDeuda),
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
     * Materias y profesores de lo que el alumno tiene por cobrar, para los filtros de "Por cobrar"
     * (decisión T-177): salen de la misma lectura que la cuenta **sin filtros** (adeudados y
     * próximos hasta el tope de cobro), así el filtro no se queda sin opciones al elegir un período,
     * una materia o un profesor. Incluye las materias y los profesores dados de baja. 404 si el
     * alumno no existe.
     */
    async opcionesDelAlumno(alumnoId: number): Promise<OpcionesDeCuenta> {
      await exigirAlumno(alumnoId)
      const fechaHoy = hoy(reloj)
      const filtroDeuda = aFiltroDeuda({}, alumnoId, fechaHoy)
      const [adeudados, proximos] = await Promise.all([
        repository.leerAdeudados(filtroDeuda),
        repository.leerProximos(filtroDeuda),
      ])
      const porCobrar = [...adeudados, ...proximos]
      const estados = await repository.estadosDeMaterias(
        porCobrar.map((a) => a.ocurrencia.materia.id),
      )
      return opcionesDeLaCuenta(porCobrar, estados)
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
        adeudados: gruposDeCuenta(cuenta.adeudados ?? []),
        proximos: gruposDeCuenta(cuenta.proximos ?? []),
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
        ? await repository.leerAdeudados(aFiltroDeuda(query, query.alumnoId, fechaHoy))
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
        ? await repository.leerProximos(aFiltroDeuda(query, query.alumnoId, fechaHoy))
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
